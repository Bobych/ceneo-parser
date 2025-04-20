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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const socket_gateway_1 = require("../gateway/socket.gateway");
let RedisService = class RedisService {
    constructor(config, socket) {
        this.config = config;
        this.socket = socket;
        this.statusKeys = [
            'product',
            'categorypage',
            'googlerow',
        ];
        this.logKeys = ['google', 'parser', 'redis'];
        this.client = new ioredis_1.default({
            host: this.config.get("REDIS_HOST"),
            port: Number(this.config.get("REDIS_PORT")),
        });
        this.pubSubClient = new ioredis_1.default({
            host: this.config.get("REDIS_HOST"),
            port: Number(this.config.get("REDIS_PORT")),
        });
        this.client.on('error', async (error) => {
            console.log(`Error by starting redis service: ${error}`);
        });
        this.pubSubClient.on('error', async (error) => {
            console.log(`Error by starting redis pub/sub: ${error}`);
        });
    }
    async onModuleInit() {
        this.statusKeys.forEach((key) => {
            const k = `status:${key}`;
            this.pubSubClient.subscribe(k, async (error, count) => {
                if (error) {
                    console.log(`[STATUS] Redis pub/sub error on ${k}: ${error}`);
                }
                else {
                    console.log(`[STATUS] Subscribed to ${count} channels. Listening for updates on ${k}.`);
                }
            });
        });
        this.logKeys.forEach((key) => {
            const k = `logs:${key}`;
            this.pubSubClient.subscribe(k, async (error, count) => {
                if (error) {
                    console.log(`[LOGS] Redis pub/sub error on ${k}: ${error}`);
                }
                else {
                    console.log(`[LOGS] Subscribed to ${count} channels. Listening for updates on ${k}.`);
                }
            });
        });
        this.pubSubClient.on('message', async (channel, message) => {
            console.log(`Received update on ${channel}: ${message}`);
            await this.handleUpdate(channel);
        });
    }
    async setStatus({ key, value }) {
        try {
            await this.client.set(key, value);
            await this.client.publish(key, 'updated');
        }
        catch (error) {
            console.log(`[REDIS] ${error}`);
        }
    }
    async setLog({ key, value }) {
        try {
            await this.client.lpush(key, value);
            await this.client.ltrim(key, 0, 99);
            await this.client.publish(key, 'updated');
        }
        catch (error) {
            console.log(`[REDIS] ${error}`);
        }
    }
    async handleUpdate(channel) {
        const [prefix, key] = channel.split(':');
        if (prefix === 'status') {
            const status = await this.client.get(channel);
            if (status) {
                await this.socket.sendStatus({
                    type: key,
                    data: status,
                });
            }
        }
        if (prefix === 'logs') {
            const logs = await this.client.lrange(channel, 0, 9);
            if (logs.length) {
                await this.socket.sendLog({
                    service: key,
                    message: logs[0],
                });
            }
        }
    }
    async getStatus({ key }) {
        try {
            return await this.client.get(key);
        }
        catch (error) {
            console.log(`[REDIS] ${error}`);
            return null;
        }
    }
    async getLog({ key }) {
        try {
            return await this.client.lrange(key, 0, 9);
        }
        catch (error) {
            console.log(`[REDIS] ${error}`);
            return [];
        }
    }
    async get({ key }) {
        return await this.client.get(key);
    }
    async set({ key, value }) {
        return await this.client.set(key, value);
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => socket_gateway_1.SocketGateway))),
    __metadata("design:paramtypes", [config_1.ConfigService,
        socket_gateway_1.SocketGateway])
], RedisService);
//# sourceMappingURL=redis.service.js.map