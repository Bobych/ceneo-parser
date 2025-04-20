"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleModule = void 0;
const common_1 = require("@nestjs/common");
const google_service_1 = require("../services/google.service");
const redis_module_1 = require("./redis.module");
const logger_module_1 = require("./logger.module");
let GoogleModule = class GoogleModule {
};
exports.GoogleModule = GoogleModule;
exports.GoogleModule = GoogleModule = __decorate([
    (0, common_1.Module)({
        imports: [redis_module_1.RedisModule, logger_module_1.LoggerModule],
        providers: [google_service_1.GoogleService],
        exports: [google_service_1.GoogleService],
    })
], GoogleModule);
//# sourceMappingURL=google.module.js.map