export interface ISheet {
  sheetId: string;
  spreadsheetId: string;
}

export interface ISheetRange extends ISheet {
  range: string;
}
