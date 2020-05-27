"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const winston_1 = __importDefault(require("winston"));
const express_winston_1 = __importDefault(require("express-winston"));
module.exports = ({ config }) => {
    let app = express_1.Router();
    if (config.get('extensions.icmaa-monitoring.datadog.enabled') === true) {
        app.use(express_winston_1.default.logger({
            transports: [
                new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.error.log`, level: 'error' }),
                new winston_1.default.transports.File({ filename: `${process.cwd()}/dist/log/winston.combined.log` })
            ],
            format: winston_1.default.format.json()
        }));
    }
    return app;
};
//# sourceMappingURL=index.js.map