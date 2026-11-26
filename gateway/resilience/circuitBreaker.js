class CircuitBreaker {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 15000;

    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.lastError = null;
    this.halfOpenInFlight = false;
  }

  canRequest() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.state = 'HALF_OPEN';
        this.halfOpenInFlight = true;
        console.log(
          `[Circuit Breaker][${this.serviceName}] OPEN -> HALF_OPEN (enviando petición de prueba)`
        );
        return true;
      }
      return false;
    }

    // En HALF_OPEN solo dejamos pasar 1 petición de prueba a la vez
    if (this.state === 'HALF_OPEN') {
      if (!this.halfOpenInFlight) {
        this.halfOpenInFlight = true;
        return true;
      }
      return false;
    }

    return false;
  }

  recordSuccess() {
    const prevState = this.state;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastError = null;
    this.halfOpenInFlight = false;

    if (prevState !== 'CLOSED') {
      console.log(
        `[Circuit Breaker][${this.serviceName}] ${prevState} -> CLOSED (servicio recuperado)`
      );
    }
  }

  recordFailure(errorMessage) {
    this.lastFailureTime = Date.now();
    this.lastError = errorMessage;
    this.halfOpenInFlight = false;

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      console.warn(
        `[Circuit Breaker][${this.serviceName}] HALF_OPEN -> OPEN (falló prueba: ${errorMessage})`
      );
      return;
    }

    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(
        `[Circuit Breaker][${this.serviceName}] CLOSED -> OPEN tras ${this.failureCount} fallos consecutivos (${errorMessage})`
      );
    }
  }

  getRetryAfterSeconds() {
    if (this.state !== 'OPEN' || !this.lastFailureTime) return 0;
    const remainingMs = Math.max(0, this.resetTimeoutMs - (Date.now() - this.lastFailureTime));
    return Math.ceil(remainingMs / 1000);
  }

  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      retryAfterSeconds: this.getRetryAfterSeconds(),
      lastError: this.lastError
    };
  }
}

module.exports = CircuitBreaker;