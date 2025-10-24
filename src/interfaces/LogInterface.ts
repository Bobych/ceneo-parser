export interface ILog {
    service: 'redis' | 'parser' | 'google';
    message: any;
}
