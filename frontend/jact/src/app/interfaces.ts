// define the datatypes that should be returned from the backend
export interface Volume {
  country: string;
  lat: number;
  lon: number;
  area: number;
  allShips: number;
  shares: Share[];
  origins: Origin[];
}

export interface Origin {
  country: string;
  numShips: number;
  lat: number;
  lon: number;
}

export interface Share {
  share: string;
  ships: number;
}

export interface Port {
  portname: string;
  country: string;
  count: number;
  plat: number;
  plon: number;
}

export interface BarChartData {
  country: string;
  lon: number;
  lat: number;
  bars: Bar[];
}

export interface Bar {
  source: string;
  distance: number;
  slon: number;
  slat: number;
}
