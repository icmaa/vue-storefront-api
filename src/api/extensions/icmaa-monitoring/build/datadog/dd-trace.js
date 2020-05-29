"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("config"));
const dd_trace_1 = __importDefault(require("dd-trace"));
const winston_1 = __importDefault(require("winston"));
if (config_1.default.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
    // Init datadog tracing agent
    dd_trace_1.default.init({
        service: 'vue-storefront-api',
        env: config_1.default.get('icmaa.mandant') + '-' + config_1.default.get('icmaa.environment'),
        clientToken: process.env.DD_CLIENT_TOKEN || config_1.default.get('extensions.icmaa-monitoring.datadog.clientToken'),
        analytics: true,
        logInjection: true
    });
    // Add logger to handle/log promise rejections
    const logger = winston_1.default.createLogger({
        format: winston_1.default.format.json(),
        transports: [
            new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
            new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
        ],
        exitOnError: false,
        exceptionHandlers: [
            new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
            new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
        ]
    });
    process.on('unhandledRejection', (error) => {
        logger.error(`Unhandled promise rejection`, error);
        console.error(`Unhandled promise rejection: ${error.message}`, error.stack || error);
    });
}
exports.default = dd_trace_1.default;
//# sourceMappingURL=dd-trace.js.map