"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("config"));
const dd_trace_1 = __importDefault(require("dd-trace"));
if (config_1.default.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
    dd_trace_1.default.init({
        service: 'vue-storefront-api',
        env: config_1.default.get('icmaa.mandant') + '-' + config_1.default.get('icmaa.environment'),
        clientToken: process.env.DD_CLIENT_TOKEN || config_1.default.get('extensions.icmaa-monitoring.datadog.clientToken'),
        analytics: true,
        logInjection: true
    });
}
exports.default = dd_trace_1.default;
//# sourceMappingURL=dd-trace.js.map