const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('admin login shows authentication failures accurately and permits retry', async () => {
    const submit = { disabled: false };
    const elements = {
        username: { value: 'owner' }, password: { value: 'wrong-password' },
        loginError: { classList: { add() {}, remove() {} } }, errorMsg: {},
        loginForm: { addEventListener(event, handler) { this.submit = handler; }, querySelector() { return submit; } }
    };
    const html = fs.readFileSync(require('node:path').join(__dirname, '../login.html'), 'utf8');
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];
    const context = {
        document: { querySelectorAll() { return []; }, getElementById(id) { return elements[id]; } },
        window: { PortfolioAPI: { baseURL: 'https://api.example.com' } },
        PortfolioAPI: { async fetch() { const error = new Error('Invalid username or password.'); error.status = 401; throw error; } }
    };
    vm.runInNewContext(script, context);
    await elements.loginForm.submit({ preventDefault() {} });
    assert.equal(elements.errorMsg.textContent, 'Invalid username or password.');
    assert.equal(submit.disabled, false);
});
