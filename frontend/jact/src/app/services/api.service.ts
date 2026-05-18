import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
// import the datatypes which are necessary for returning data from the backend
import { Volume, Share, Port, BarChartData } from '../interfaces';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  constructor(private http: HttpClient) {}

  private ships: any;

  /**
   * Method for calling the backend to retrieve data for plotting piecharts of import and export volumes on countries
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   * @returns
   */
  public getPieData(start?: string, end?: string) {
    let url = 'http://localhost:5000/pieData';
    // in this case, both dates are selected by the user
    if (typeof start == 'string' && typeof end == 'string') {
      // assemble url with parameters
      url += '?start=' + start + '&end=' + end;
      // observable is async
      return this.http.get<Volume[]>(url);
    }
    // in this case, no date is selected- return for whole time range
    // backend handles this case if the arguments of the url are empty
    return this.http.get<Volume[]>(url);
  }

  /**
   * Method for calling the backend to retrieve data for plotting aggregated infos on the ports
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   * @returns
   */
  public getDotData(start?: string, end?: string) {
    let url = 'http://localhost:5000/dotData';

    //in this case, both dates are selected by the user
    if (typeof start == 'string' && typeof end == 'string') {
      // assemble url with parameters
      url += '?start=' + start + '&end=' + end;
      // observable is async
      return this.http.get<Port[]>(url);
    }
    // in this case, no date is selected- return for whole time range
    // backend handles this case if the arguments of the url are empty
    return this.http.get<Port[]>(url);
  }

  /**
   * Method for calling the backend to retrieve data for plotting barcharts
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   * @returns
   */
  public getBarData(start?: string, end?: string) {
    let url = 'http://localhost:5000/barChartData';

    // in this case, both dates are selected by the user
    if (typeof start == 'string' && typeof end == 'string') {
      // assemble url with parameters
      url += '?start=' + start + '&end=' + end;

      // observable is async
      return this.http.get<BarChartData[]>(url);
    }

    // in this case, no date is selected- return for whole time range
    // backend handles this case if the arguments of the url are empty
    return this.http.get<BarChartData[]>(url);
  }

  /**
   * Method for calling the backend to retrieve data for plotting the heatmap
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   * @returns
   */
  public getHeatMapData(start?: string, end?: string) {
    let url = 'http://localhost:5000/heatMapData';

    //in this case, both dates are selected by the user
    if (typeof start == 'string' && typeof end == 'string') {
      // assemble url with parameters
      url += '?start=' + start + '&end=' + end;
      // observable is async
      return this.http.get<any>(url);
    }
    // in this case, no date is selected- return for whole time range
    // backend handles this case if the arguments of the url are empty
    return this.http.get<any>(url);
  }

  
  /**
   * Method for calling the backend to retrieve data with the applied filter for plotting the heatmap 
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   * @param keyword1 country name
   * @param keyword2 ship name
   * @returns
   */
  public getHeatMapDataFilter(start?: string, end?: string, keyword1?: string, keyword2?: string) {
    let url = 'http://localhost:5000/heatMapDataFilter';

    //in this case, both dates are selected by the user
    if (typeof start == 'string' && typeof end == 'string' && typeof keyword1 == 'string' && typeof keyword2 == 'string') {
      // assemble url with parameters
      url += '?start=' + start + '&end=' + end + '&keyword1=' + keyword1 + '&keyword2=' + keyword2;
      // observable is async
      return this.http.get<any>(url);
    }
    // in this case, no date is selected- return for whole time range
    // backend handles this case if the arguments of the url are empty

    url += '?keyword1=' + keyword1 + '&keyword2=' + keyword2;
    return this.http.get<any>(url);
  } 

  

  public setAllShips(ships: any) {
    this.ships = ships;
  }

  public getAllShips() {
    return this.ships;
  }
}
