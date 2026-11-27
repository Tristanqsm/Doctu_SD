const { Resolver } = require('dns').promises;
const { enviar } = require('./httpClient');

// Consulta directa al DNS interno de Docker (127.0.0.11). Si un nombre no tiene
// contenedores vivos, Docker reenvía la consulta al DNS externo y puede tardar varios
// segundos en contestar: se acota a 1s con un solo intento.
const resolver = new Resolver({ timeout: 1000, tries: 1 });

/*
 * Balanceador de carga del lado del gateway (round robin + health check activo)
 * ---------------------------------------------------------------------------
 * Equivalencias con el lab S07 (Mexi Banco):
 *
 *   Eureka (directorio)            -> DNS interno de Docker Compose. Con `replicas: 2`,
 *                                     el nombre `servicio-expedientes` resuelve a 2 IPs.
 *   Heartbeat de cada instancia    -> health check activo: el balanceador hace GET /health
 *                                     a cada IP cada 5s y saca de la rotación a la que no
 *                                     responda 200 a tiempo.
 *   Spring Cloud LoadBalancer      -> esta clase: reparte por turnos (round robin) entre
 *     (caché que se renueva c/5s)     las instancias sanas y renueva la lista cada 5s.
 *
 * ¿Por qué no basta el DNS? Docker quita la IP de un contenedor detenido, pero NO la de
 * un contenedor vivo y colgado (pausado, sin base de datos, /health en 503): esa IP sigue
 * en el DNS. El health check cubre ese caso, como el heartbeat en Eureka.
 *
 * Además hay chequeo pasivo: si una petición real falla por red, la instancia sale de la
 * rotación de inmediato (sin esperar al siguiente ciclo) y se fuerza un refresco.
 */
class LoadBalancer {
  constructor(servicio, puerto, opciones = {}) {
    this.servicio = servicio;
    this.puerto = puerto;
    this.intervaloMs = opciones.intervaloMs || 5000;
    this.healthTimeoutMs = opciones.healthTimeoutMs || 1500;
    this.healthPath = opciones.healthPath || '/health';

    this.instancias = new Map(); // ip -> { ip, replica, sana, motivo, servidas, ultimoChequeo }
    this.turno = 0;
    this.ultimoRefresco = null;
    this.errorDns = null;
    this.refrescoEnCurso = null;
    this.timer = null;
  }

  iniciar() {
    this.refrescar();
    this.timer = setInterval(() => this.refrescar(), this.intervaloMs);
    return this;
  }

  log(mensaje) {
    console.log(`[Balanceador][${this.servicio}] ${mensaje}`);
  }

  nombre(inst) {
    return inst.replica ? `${inst.ip} (${inst.replica})` : inst.ip;
  }

  /** Un ciclo: resolver DNS (altas/bajas) + health check de cada IP. */
  refrescar() {
    if (this.refrescoEnCurso) return this.refrescoEnCurso;

    this.refrescoEnCurso = (async () => {
      let ips = [];
      try {
        ips = await resolver.resolve4(this.servicio);
        this.errorDns = null;
      } catch (err) {
        // ENOTFOUND: no hay ningún contenedor vivo con ese nombre
        this.errorDns = err.code || err.message;
      }
      ips.sort();

      for (const [ip, inst] of this.instancias) {
        if (!ips.includes(ip)) {
          this.instancias.delete(ip);
          this.log(`BAJA ${this.nombre(inst)}: ya no aparece en el DNS de Docker`);
        }
      }
      for (const ip of ips) {
        if (!this.instancias.has(ip)) {
          // Entra fuera de rotación hasta pasar su primer health check
          this.instancias.set(ip, { ip, replica: null, sana: false, motivo: 'pendiente de health check', servidas: 0, ultimoChequeo: null });
          this.log(`ALTA ${ip}: descubierta en el DNS de Docker`);
        }
      }

      await Promise.all(ips.map((ip) => this.chequear(ip)));
      this.ultimoRefresco = new Date().toISOString();
    })().finally(() => {
      this.refrescoEnCurso = null;
    });

    return this.refrescoEnCurso;
  }

  async chequear(ip) {
    const inst = this.instancias.get(ip);
    if (!inst) return;

    try {
      const resp = await enviar({
        host: ip,
        port: this.puerto,
        method: 'GET',
        path: this.healthPath,
        connectTimeoutMs: this.healthTimeoutMs,
        timeoutMs: this.healthTimeoutMs
      });
      if (resp.headers['x-served-by']) inst.replica = resp.headers['x-served-by'];

      if (resp.status === 200) this.marcarSana(inst);
      else this.marcarFuera(inst, `/health respondió ${resp.status}`);
    } catch (err) {
      this.marcarFuera(inst, `/health falló: ${err.message}`);
    } finally {
      inst.ultimoChequeo = new Date().toISOString();
    }
  }

  marcarSana(inst) {
    if (!inst.sana) this.log(`${this.nombre(inst)} -> EN ROTACIÓN`);
    inst.sana = true;
    inst.motivo = null;
  }

  marcarFuera(inst, motivo) {
    if (inst.sana) this.log(`${this.nombre(inst)} -> FUERA DE ROTACIÓN (${motivo})`);
    inst.sana = false;
    inst.motivo = motivo;
  }

  /**
   * Elige la siguiente instancia por turnos entre las sanas, evitando las de `excluir`
   * (las que ya fallaron en esta misma petición). Si ninguna está sana se intenta con
   * cualquiera que el DNS reporte (mejor intentar que rechazar sin probar).
   * Regresa null si el DNS no reporta ninguna instancia.
   */
  elegir(excluir = new Set()) {
    const todas = [...this.instancias.values()];
    const conExclusion = todas.filter((i) => !excluir.has(i.ip));
    const base = conExclusion.length > 0 ? conExclusion : todas;

    let candidatas = base.filter((i) => i.sana);
    if (candidatas.length === 0) candidatas = base;
    if (candidatas.length === 0) return null;

    const inst = candidatas[this.turno % candidatas.length];
    this.turno = (this.turno + 1) % 1000000;
    inst.servidas += 1;
    return inst;
  }

  /** Chequeo pasivo: una petición real falló por red contra esta instancia. */
  reportarFallo(ip, motivo) {
    const inst = this.instancias.get(ip);
    if (inst) this.marcarFuera(inst, `petición falló: ${motivo}`);
    this.refrescar();
  }

  getStatus() {
    const instancias = [...this.instancias.values()].map((i) => ({
      ip: i.ip,
      replica: i.replica,
      en_rotacion: i.sana,
      motivo: i.motivo,
      peticiones_enviadas: i.servidas,
      ultimo_chequeo: i.ultimoChequeo
    }));
    return {
      algoritmo: 'round-robin',
      health_check: `GET ${this.healthPath} cada ${this.intervaloMs / 1000}s (timeout ${this.healthTimeoutMs}ms)`,
      instancias_en_rotacion: instancias.filter((i) => i.en_rotacion).length,
      instancias_en_dns: instancias.length,
      error_dns: this.errorDns,
      ultimo_refresco: this.ultimoRefresco,
      instancias
    };
  }
}

module.exports = LoadBalancer;
