import Papa from 'papaparse';

export type OHLC = {
  close: string;
  high: string;
  low: string;
  open: string;
};

export function fromCSV(csvString: string) {
  const parsed = Papa.parse<OHLC>(csvString, {
    delimiter: ',',
    dynamicTyping: false,
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data;
}
