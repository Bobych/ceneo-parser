"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiController = void 0;
const common_1 = require("@nestjs/common");
const parser_service_1 = require("../services/parser.service");
const api_guard_1 = require("../api/api.guard");
let ApiController = class ApiController {
    constructor(parser) {
        this.parser = parser;
    }
    async restart() {
        try {
            this.parser.restart();
            return { message: 'Process restarted successfully.' };
        }
        catch (error) {
            return { message: 'Failed to restart process.', error: error.message };
        }
    }
};
exports.ApiController = ApiController;
__decorate([
    (0, common_1.Post)('restart'),
    (0, common_1.UseGuards)(api_guard_1.ApiTokenGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ApiController.prototype, "restart", null);
exports.ApiController = ApiController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [parser_service_1.ParserService])
], ApiController);
//# sourceMappingURL=api.controller.js.map