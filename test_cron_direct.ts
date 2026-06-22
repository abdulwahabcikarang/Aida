import 'dotenv/config';
import handler from './api/cron.ts';

const req = { method: 'POST' };
const res = {
  status: function(code) {
    this.code = code;
    return this;
  },
  json: function(data) {
    console.log("STATUS:", this.code);
    console.log("RESPONSE:", data);
  }
};

handler(req, res).catch(console.error);
