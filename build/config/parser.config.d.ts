export declare const ParserConfig: {
    browserConfig: {
        headless: boolean;
        executablePath: string;
        args: string[];
        protocolTimeout: number;
        ignoreHTTPSErrors: boolean;
        defaultViewport: {
            width: number;
            height: number;
            deviceScaleFactor: number;
        };
    };
    proxy: () => string;
    userAgent: () => string;
    categoryClasses: {
        category: string;
        name: string;
        url: string;
    };
    productClasses: {
        name: string;
        offer: string;
        price: string;
        availability: string;
        supplier: string;
    };
};
