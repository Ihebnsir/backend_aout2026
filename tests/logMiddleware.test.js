const { expect } = require('chai');
const logMiddleware = require('../src/middleware/logMiddleware');

describe('Log middleware', () => {
  it('should be a function and register a finish hook', () => {
    expect(logMiddleware).to.be.a('function');

    const req = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {},
    };

    const res = {
      statusCode: 200,
      on(event, handler) {
        if (event === 'finish') {
          this.finishHandler = handler;
        }
        return this;
      },
    };

    let nextCalled = false;

    logMiddleware(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).to.equal(true);
    expect(res.finishHandler).to.be.a('function');
  });
});
