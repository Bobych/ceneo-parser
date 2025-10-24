export interface ProductDto {
    externalId?: number;
    name: string;
    price?: number | null;
    url: string;
    flag?: boolean;
    sheetName: string;
}
