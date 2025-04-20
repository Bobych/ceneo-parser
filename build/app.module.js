"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_module_1 = require("./modules/google.module");
const parser_module_1 = require("./modules/parser.module");
const app_controller_1 = require("./controllers/app.controller");
const api_controller_1 = require("./controllers/api.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: process.env.NODE_ENV == "production"
                    ? `./.env.${"production"}`
                    : `./.env.${"development"}`,
            }),
            google_module_1.GoogleModule,
            parser_module_1.ParserModule,
        ],
        controllers: [app_controller_1.AppController, api_controller_1.ApiController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map