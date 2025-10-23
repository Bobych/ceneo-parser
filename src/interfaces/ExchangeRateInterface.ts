interface IRate {
  no: string;
  effectiveDate: string;
  bid: number;
  ask: number;
}

export interface IExchangeRate {
  table: string;
  currency: string;
  code: string;
  rates: IRate[];
}
