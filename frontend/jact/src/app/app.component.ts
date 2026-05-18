import { Component, OnInit } from '@angular/core';
import { ApiService } from './services/api.service';
import { FormGroup, FormControl } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {MatSelectModule} from '@angular/material/select';
import * as mapboxgl from 'mapbox-gl';
import * as d3 from 'd3';
// import the datatypes which are necessary for returning data from the backend
import { Volume, Share, Port, BarChartData, Origin } from './interfaces';
import { share } from 'rxjs';
import { tickStep } from 'd3';

// define map as global variable for accessing it outside the ngOnInit()
let map: mapboxgl.Map;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // progress bar
  isLoading: boolean = false;

  // variable for date range selection
  range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  rangeDisabled: boolean = false;

  // set min and max date
  minDate: Date = new Date('2012-01-01');
  maxDate: Date = new Date('2022-12-31');

  // sidebar is shown when loading the site
  public sidebarShow: boolean = true;

  // class variables for pie chart visualization
  pieChartStart: string;
  pieChartEnd: string;
  pieChartPopups: mapboxgl.Popup[];
  public toolTip: any;
  layerIds: string[];
  checkLinesPlotted: boolean;
  pieChartDisabled: boolean = false;
  pieChartColourScale: d3.ScaleOrdinal<string, string, never>;
  colourRange = [
    '#ff0000',
    '#ff7f00',
    '#ffff00',
    '#00ff00',
    '#00ffff',
    '#0000ff',
    '#8b00ff',
    '#000000',
    '#800000',
    '#808000',
    '#008080',
    '#000080',
    '#800080',
    '#808080',
    '#ff5151',
    '#ffa64d',
    '#ffff4d',
    '#51ff51',
    '#51ffff',
    '#5151ff',
    '#ff51ff',
    '#4d4d4d',
    '#990000',
    '#996000',
    '#999900',
    '#009900',
    '#009999',
    '#000099',
    '#990099',
    '#999999',
    '#ff8c8c',
    '#ffd68c',
    '#ffff8c',
    '#8cff8c',
    '#8cffff',
    '#8c8cff',
    '#ff8cff',
    '#8c8c8c',
    '#cc0000',
    '#cc6600',
    '#cccc00',
    '#00cc00',
    '#00cccc',
    '#0000cc',
    '#cc00cc',
    '#cccccc',
    '#ffb3b3',
    '#ffe6b3',
    '#ffffb3',
    '#b3ffb3',
    '#b3ffff',
    '#b3b3ff',
    '#ffb3ff',
    '#b3b3b3',
    '#330000',
    '#331900',
    '#333300',
    '#003300',
    '#003333',
    '#000033',
    '#330033',
    '#333333',
    '#ff4d4d',
    '#ff964d',
    '#ffff4d',
    '#4dff4d',
    '#4dffff',
    '#4d4dff',
    '#ff4dff',
    '#1e1e1e',
    '#660000',
    '#663300',
    '#666600',
    '#006600',
    '#006666',
    '#000066',
    '#660066',
    '#666666',
    '#ff8080',
    '#ffb380',
    '#ffff80',
    '#80ff80',
    '#80ffff',
    '#8080ff',
    '#ff80ff',
    '#3c3c3c',
    '#990000',
    '#994c00',
    '#999900',
    '#009900',
    '#009999',
    '#000099',
    '#990099',
    '#999999',
    '#ffb3b3',
    '#ffe6b3',
    '#ffffb3',
    '#b3ffb3',
    '#b3ffff',
    '#b3b3ff',
    '#ffb3ff',
    '#595959',
    '#cc0000',
    '#cc3300',
    '#cccc00',
    '#00cc00',
    '#00cccc',
    '#0000cc',
    '#cc00cc',
    '#cccccc',
    '#ffcccc',
    '#ffffcc',
    '#ccffcc',
    '#ccffff',
    '#ccccff',
    '#ffccff',
    '#7f7f7f',
    '#e60000',
    '#e61919',
    '#e6e600',
    '#00e600',
    '#00e6e6',
    '#0000e6',
    '#e600e6',
    '#e6e6e6',
    '#ff4d4d',
    '#ff964d',
    '#ffff4d',
    '#4dff4d',
    '#4dffff',
    '#4d4dff',
    '#ff4dff',
    '#a6a6a6',
    '#ff0000',
    '#ff3333',
    '#ffff00',
  ];
  showPieLegend: boolean = true;
  showPieLegendButton: boolean = false;
  pieLegendContent: SafeHtml = '';

  // class variables for port popup visualization
  dotPopups: mapboxgl.Popup[];
  portDisabled: boolean = false;

  // class variables for bar chart visualization
  barMarkers: mapboxgl.Marker[];
  barPopups: mapboxgl.Popup[];
  barChartDisabled: boolean = false;

  // flag for date checking
  olddate: boolean = false;

  // flags for encounter plot
  encountersChecked: boolean = false;
  authorizedChecked: boolean = false;
  unauthorizedChecked: boolean = false;

  // flags if slider are disabled
  encounterDisabled: boolean = false;
  showAuthorizedDisabled: boolean = true;
  showUnauthorizedDisabled: boolean = true;

  // slider flags for activations
  checkedAuthorized: boolean = false;
  checkedUnauthorized: boolean = false;
  // flag if data is requested for heatmap
  request_data_once: boolean = false;

  // flags for active visualizations
  piechartactive: boolean = false;
  portsactive: boolean = false;
  barchartactive: boolean = false;
  heatmapactive: boolean = false;

  // variables for storing data from encounters
  authorized_data: any = [];
  unauthorized_data: any = [];

  // filter heatmap by dropdown
  selected_country:any = undefined;
  selected_ship:any = undefined;

  //dropdown lists cpuntries and ships
  country_names_authorized : any = [];
  ship_names_authorized : any = [];
  country_names_unauthorized : any = [];
  ship_names_unauthorized : any = [];
  country_names_all:any = [];
  ship_names_all:any = [];

  // dropdown list variable
  country_names:any = [];
  ship_names:any = [];
  disabledCountryFilter :boolean = true; 
  disabledShipFilter :boolean = true; 



  // initialize variables
  constructor(private api: ApiService, private _sanitizer: DomSanitizer) {
    this.dotPopups = [];
    this.pieChartPopups = [];
    this.pieChartStart = '';
    this.pieChartEnd = '';
    this.barMarkers = [];
    this.barPopups = [];
    this.layerIds = [];
    this.checkLinesPlotted = false;
    // this.pieChartColourScale = d3.scaleOrdinal<string>().range(d3.schemeCategory10);
    this.pieChartColourScale = d3
      .scaleOrdinal<string>()
      .range(this.colourRange);
  }

  ngOnInit(): void {
    // MAPBOX
    // assign access token to get tileservers and mapbox studio designs
    (mapboxgl as any).accessToken =
      'pk.eyJ1IjoiNDMyNTc0NTg0ODUyNDQ1IiwiYSI6ImNrb21zdWlxcTE1encydm8wdjRwZ3FlNjMifQ.tpts-G1GGZ6dtNge6Mclcg';
    // set initial view on the map
    const initialState = { lng: 11, lat: 49, zoom: 3 };
    // create map component
    map = new mapboxgl.Map({
      container: 'map',
      style: 'mapbox://styles/432574584852445/ckw6fbivn2onw14lce6vcubjk',
      center: [initialState.lng, initialState.lat],
      zoom: initialState.zoom,
    });
    // add navigation
    const nav = new mapboxgl.NavigationControl();
    map.addControl(nav, 'top-right');

    // hide the legend for pie charts / the div must be created first and then hidden in order to access it
    this.showPieLegend = false;

    // listen to the datepicker for range changes
    this.range.valueChanges.subscribe((res) => {
      if (this.olddate) {
        // a date range consist of to inputs, each input (start, end) emit an event
        // a new select of a range starting with the start date fires twice and uses the old date
        // therefore we have to  reset the values of the datepicker

        this.range.value.start = null;
        this.range.value.end = null;
        this.olddate = false;
      }

      // check if start and end are valid
      const startString = res.start;
      const endString = res.end;
      let start;
      let end;
      if (
        startString == null ||
        startString == undefined ||
        endString == undefined ||
        endString == null
      ) {
        start = undefined;
        end = undefined;
      } else {
        start = this.dateToStr(startString);
        end = this.dateToStr(endString);
      }

      const re = '201[2-9]|202[0-2] - 0[1-9]|[10-12] - 0[1-9]|[10-31]';
      const regex = new RegExp(re);

      if (start !== undefined && end !== undefined) {
        if (regex.test(start) && regex.test(end)) {
          // if date is selected and in correct format the rerender visualization with new range
          if (this.heatmapactive) {
                   
            if(this.selected_country != 'none' ||this.selected_ship != 'none'){
              this.applyFilter();
            }else{
              this.resetHeatMap();
              this.request_data_once = false;
              this.generateHeatMap(start, end);
            }
            this.olddate = true;
          }

          if (this.piechartactive) {
            this.destroyPie();
            this.generatePie(start, end);
            this.olddate = true;
          }

          if (this.portsactive) {
            this.destroyDot();
            this.generateDot(start, end);
            this.olddate = true;
          }

          if (this.barchartactive) {
            this.destroyBar();
            this.generateBar(start, end);
            this.olddate = true;
          }
        }
      }
    });
  }

  // ************************************ Methods for buttons ************************************

  /**
   * Method for checkbox event handling
   * @param event
   */
  volumeCheckBoxChange(event: any) {
    if (event.checked) {
      // checkbox is checked - create pie charts
      const startString = this.range.value.start;
      const endString = this.range.value.end;
      let start;
      let end;
      if (
        startString == null ||
        startString == undefined ||
        endString == undefined ||
        endString == null
      ) {
        start = undefined;
        end = undefined;
      } else {
        start = this.dateToStr(startString);
        end = this.dateToStr(endString);
      }
      this.generatePie(start, end);
    } else {
      // checkbox is unchecked, delete pie charts
      this.destroyPie();
    }
  }

  /**
   * Method for checkbox event handling
   * @param event
   */
  portsCheckBoxChange(event: any) {
    if (event.checked) {
      // checkbox is checked - create dots
      const startString = this.range.value.start;
      const endString = this.range.value.end;
      let start;
      let end;
      if (
        startString == null ||
        startString == undefined ||
        endString == undefined ||
        endString == null
      ) {
        start = undefined;
        end = undefined;
      } else {
        start = this.dateToStr(startString);
        end = this.dateToStr(endString);
      }
      this.generateDot(start, end);
    } else {
      // checkbox is unchecked, delete dots
      this.destroyDot();
    }
  }

  /**
   * Method for checkbox event handling
   * @param event
   */
  barchartCheckBoxChange(event: any) {
    if (event.checked) {
      // checkbox is checked - create dots
      const startString = this.range.value.start;
      const endString = this.range.value.end;
      let start;
      let end;
      if (
        startString == null ||
        startString == undefined ||
        endString == undefined ||
        endString == null
      ) {
        start = undefined;
        end = undefined;
      } else {
        start = this.dateToStr(startString);
        end = this.dateToStr(endString);
      }
      this.generateBar(start, end);
    } else {
      // checkbox is unchecked, delete dots
      this.destroyBar();
    }
  }

  /**
   * Method for checkbox event handling
   * @param event
   */
  encountersCheckBoxChange(event: any) {
    if (event.checked) {
      // checkbox is checked - create heat map
      const startString = this.range.value.start;
      const endString = this.range.value.end;
      let start;
      let end;
      if (
        startString == null ||
        startString == undefined ||
        endString == undefined ||
        endString == null
      ) {
        start = undefined;
        end = undefined;
      } else {
        start = this.dateToStr(startString);
        end = this.dateToStr(endString);
      }

      this.encountersChecked = true;

      if(map.getSource('unauthorized') != undefined && map.getSource('authorized') != undefined){
        map.removeLayer('unknown');
        map.removeLayer('authorized');
        map.removeSource('unauthorized');
        map.removeSource('authorized');
      }else if (map.getSource('authorized') != undefined){
        map.removeLayer('authorized');
        map.removeSource('authorized');
      }else if (map.getSource('unauthorized') != undefined){
        map.removeLayer('unknown');
        map.removeSource('unauthorized');
      }

      this.generateHeatMap(start, end);
    
      this.heatmapactive = true;

    } else {//*
      this.resetHeatMap();
      this.request_data_once = false;
      this.heatmapactive = false;
      this.ship_names = [];
      this.country_names = [];
      this.selected_ship = undefined;
      this.selected_country = undefined;
    }
  }

  // ************************************ Methods for visualizations ************************************

  /**
   * Method for generating country pie charts on the map
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   */
  generatePie(start?: string, end?: string) {
    // save dates for event methods of mouseover
    this.pieChartStart = start ? start : '';
    this.pieChartEnd = end ? end : '';

    // set the active flag
    this.piechartactive = true;

    // show progress bar
    this.showLoadingBar(true);

    // getPieData is a method from apiservice (call backend and return data)
    // subscribe is similar to: call backend and wait until it is finished and then put returned data into arguments
    this.api.getPieData(start, end).subscribe((data) => {
      // hide loading bar
      this.showLoadingBar(false);

      // check if the result is empty
      let check = 0;
      for (const key in data) {
        check++;
      }
      if (check == 0) {
        alert(
          '\n No data entries found for given time range.\n Try choosing a braoder or different date range instead.\n\n Press "okay" to continue'
        );
        return;
      }

      // set the colourscale according to all shares
      const shareCountries: any[] = [];
      // first get all the shares
      for (const key in data) {
        for (const k in data[key].shares) {
          shareCountries.push(data[key].shares[k].share);
        }
      }

      // remove duplicates
      const uniqueShareCountries = [...new Set(shareCountries)];

      // sort according to the # of appearences of that country
      const sortedCountries = uniqueShareCountries.sort((a, b) => {
        return (
          shareCountries.filter((c) => c === b).length -
          shareCountries.filter((c) => c === a).length
        );
      });

      // set the colorscale
      this.pieChartColourScale.domain(sortedCountries);

      // show the button for the legend
      this.showPieLegendButton = true;

      // fill the list of the legend
      let htmlStr = '';
      sortedCountries.forEach((country) => {
        const localColor = this.pieChartColourScale(country);
        // for each country add a colour samble with text to the html
        htmlStr +=
          "<div style='background-color:" +
          localColor +
          "; height: 10px; width: 10px; display: inline-block; font-size: 10px;'></div>  " +
          country +
          '<br>';
      });

      // set the list to the content of the legend
      this.pieLegendContent = this._sanitizer.bypassSecurityTrustHtml(htmlStr);

      // set the dimensions of the d3 svg
      let maxWidth = 500;
      const minWidth = 50;
      const margin = 10;

      // get zoom
      const currZoom = map.getZoom();

      // scale for the width
      let widthScale = d3
        .scaleLinear()
        .domain([0, 20])
        .range([minWidth, maxWidth]);

      maxWidth = widthScale(currZoom);
      let maxRadius = maxWidth / 2 - margin;

      // scaling of the piecharts according to the area of the countries
      let allShips: number[] = [];
      // map area to extra arry to extract min and max
      for (const key in data) {
        allShips.push(+data[key].allShips);
      }

      // trick the type inference
      let allShipsExt = d3.extent(allShips);
      const allShipsMin: number =
        allShipsExt[0] == undefined ? 0 : allShipsExt[0];
      const allShipsMax: number =
        allShipsExt[1] == undefined ? 0 : allShipsExt[1];
      allShipsExt = [allShipsMin, allShipsMax];

      // store all ship to the api object
      this.api.setAllShips(allShipsExt);

      // radius scale for resizing the piecharts
      let radiusScale = d3
        .scaleLog()
        .range([10, maxRadius])
        .domain(allShipsExt);

      // counter for the ids of the svgs
      let idCounter = 0;

      // iterate through all countries
      for (const key in data) {
        // get the current entry and create an id
        const volume: Volume = data[key];
        const divID = 'pie' + (idCounter++).toString();

        // ----------- create div -----------
        const div = document.createElement('div');
        div.setAttribute('id', divID);

        // ----------- mapbox popup display -----------
        // Add the pie chart div to a Mapbox popup and add the popup to the map
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeOnClick: false,
          closeButton: false,
          anchor: 'center',
          maxWidth: '500px',
        })
          .setDOMContent(div)
          .setLngLat([volume.lon, volume.lat])
          .addTo(map);

        // append popup to the list of popups
        this.pieChartPopups.push(popup);

        // get html element of popup and set the styling of the popup content
        const htmlpopup = (popup.getElement() as HTMLElement)
          .children[1] as HTMLElement;
        htmlpopup.style.width = (map.getZoom() * 50).toString + 'px';
        htmlpopup.style.background = 'transparent';
        htmlpopup.style.boxShadow = 'none';
        htmlpopup.style.pointerEvents = 'none';
        htmlpopup.style.paddingBottom = '6px';
        // set id in order to access the popup when hovering
        htmlpopup.id = '' + idCounter;

        // detele popup tip
        (popup.getElement() as HTMLElement).removeChild(
          (popup.getElement() as HTMLElement).children[0]
        );

        // ----------- create svg -----------
        const svg = d3
          .select('#' + divID)
          .append('svg')
          .attr('width', maxWidth)
          .attr('height', maxWidth)
          .append('g')
          .attr(
            'transform',
            'translate(' + maxWidth / 2 + ',' + maxWidth / 2 + ')'
          );

        // ----------- create piechart -----------

        const shares = volume.shares;

        // Compute the position of each group on the pie:
        const pie = d3.pie<Share>().value((d: Share) => d.ships);

        const data_ready = pie(shares);

        let currShips: number = 0;
        for (const s in shares) {
          let tmp: number = +shares[s].ships;
          currShips = currShips + tmp;
        }

        // Build arcs
        let arc = d3
          .arc<d3.PieArcDatum<Share>>()
          .innerRadius(0)
          .outerRadius(radiusScale(+volume.allShips));

        // append piecharts to the svg
        svg
          .selectAll('arc')
          .data(data_ready)
          .join('path')
          .attr('d', arc)
          .attr('fill', (d) => this.pieChartColourScale(d.data.share))
          .attr('stroke', 'black')
          .style('stroke-width', '2px')
          .style('opacity', 0.7)
          .style('pointer-events', 'auto')
          .classed(volume.country, true)
          .on('mousemove', (d) => this.mousemove(d, data, start, end))
          .on('mouseleave', (d) => this.mouseleave(d));

        // handle zoom event on map: zoom out -> pie charts should get smaller
        map.on('zoomend', () => {
          const zoom = map.getZoom();
          maxWidth = widthScale(zoom);
          // scale the width and height of the svg elemnt
          d3.select('#' + divID)
            .select('svg')
            .attr('width', maxWidth)
            .attr('height', maxWidth);
          // transform translate the g element within each svg
          svg.attr(
            'transform',
            'translate(' + maxWidth / 2 + ',' + maxWidth / 2 + ')'
          );

          // calculate new max radius for piecharts
          maxRadius = maxWidth / 2 - margin;

          // scale radius of piechart
          // range of the scale changed - adjust scale
          const allShipsExt = this.api.getAllShips();
          const radiusScaleChange = d3
            .scaleLog()
            .range([10, maxRadius])
            .domain(allShipsExt);

          // adjust outer radius of arc
          arc = arc.outerRadius(radiusScaleChange(+volume.allShips));

          // delete all previous plottedt paths and texts
          if (!svg.selectAll('path').empty()) svg.selectAll('path').remove();

          // redraw paths
          svg
            .selectAll('arc')
            .data(data_ready)
            .join('path')
            .attr('d', arc)
            .attr('fill', (d) => this.pieChartColourScale(d.data.share))
            .attr('stroke', 'black')
            .style('stroke-width', '2px')
            .style('opacity', 0.7)
            .style('pointer-events', 'auto')
            .classed(volume.country, true)
            .on('mousemove', (d) => this.mousemove(d, data, start, end))
            .on('mouseleave', (d) => this.mouseleave(d));
        });
      }
    });
  }

  /**
   * Method for event handling when mouse moves on a path element of piechart
   * @param of type any. Contains the path element in event.target
   * @param volumes: array of all data for piechart visualization
   * @param start date of selected time range
   * @param end date of selected time range
   */
  mousemove(event: any, volumes: Volume[], start?: string, end?: string) {
    // hovering over one path makes it darker
    d3.select(event.target).style('opacity', 1);

    // hide all other piecharts
    this.hidePies(
      event.target.parentElement.parentElement.parentElement.parentElement.id
    );

    // find all other path elements and their colours
    let countrySave: string = '';
    let htmlStr = '';
    // iterate through all volumes of a country
    let countryKey: number = 0;
    for (const key in volumes) {
      // cheese the data assignment in d3 by searching for the right volume in all volumes with the css class
      if (d3.select(event.target).classed(volumes[key].country)) {
        // assemble html of tooltip
        countryKey = <number>(<unknown>key); // more jankyness
        break;
      }
    }
    htmlStr =
      '<a style="font-size: 18px; font-weight: 300;">' +
      volumes[countryKey].country +
      '</a><br>';
    countrySave = volumes[countryKey].country;
    // iterate through all chares of that country, i.e. all countries that shipped fish to the current country
    volumes[countryKey].shares.forEach((share) => {
      const localColor = this.pieChartColourScale(share.share);
      let weight: string = 'normal';
      if (event.target.__data__.data.share.toString() == share.share) {
        weight = '900';
      }
      // for each country add a colour samble with text to the html
      htmlStr +=
        "<div style='font-weight: " +
        weight +
        ";'><div style='background-color:" +
        localColor +
        "; height: 10px; width: 10px; display: inline-block; font-size: 10px;'></div>  " +
        share.share +
        ': ' +
        share.ships +
        '<br>';
    });

    // remove last line break
    htmlStr = htmlStr.substring(0, htmlStr.length - 4);
    
    this.toolTip = d3
      .select('#tooltip')
      .attr('class', 'mapboxgl-interactive mapboxgl-touch-drag-pan')
      .html(htmlStr) // '<a>' + event.target.__data__.data.share + ' ' + numShips + ': ships</a>'
      .style('visibility', 'visible')
      .style('left', event.pageX + 10 + 'px')
      .style('top', event.pageY + 15 + 'px');

    // Get the width and height of the tooltip
    const toolTipWidth = this.toolTip.node().offsetWidth;
    const toolTipHeight = this.toolTip.node().offsetHeight;
    const toolTipPosition = this.toolTip.node().getBoundingClientRect();

    // Check if the right side of the tooltip is outside the viewport
    if (toolTipPosition.right + toolTipWidth > window.innerWidth) {
      this.toolTip.style('left', toolTipPosition.left - toolTipWidth - 10 + 'px');
    }

    if (toolTipPosition.bottom + toolTipHeight > window.innerHeight) {
      this.toolTip.style('top', toolTipPosition.top - toolTipHeight - 15 + 'px');
    }

    //                             . .  ,  ,
    //                             |` \/ \/ \,',
    //                             ;          ` \/\,.
    //                            :               ` \,/
    //                            |                  /
    //                            ;                 :
    //                           :                  ;
    //                           |      ,---.      /
    //                          :     ,'     `,-._ \
    //                          ;    (   o    \   `'
    //                        _:      .      ,'  o ;
    //                       /,.`      `.__,'`-.__,
    //                       \_  _               \
    //                      ,'  / `,          `.,'
    //                ___,'`-._ \_/ `,._        ;
    //             __;_,'      `-.`-'./ `--.____)
    //          ,-'           _,--\^-'
    //        ,:_____      ,-'     \
    //       (,'     `--.  \;-._    ;
    //       :    Y      `-/    `,  :
    //       :    :       :     /_;'
    //       :    :       |    :
    //        \    \      :    :
    //         `-._ `-.__, \    `.
    //            \   \  `. \     `.
    //          ,-;    \---)_\ ,','/
    //          \_ `---'--'" ,'^-;'
    //          (_`     ---'" ,-')
    //          / `--.__,. ,-'    \
    //          )-.__,-- ||___,--' `-.
    //         /._______,|__________,'\
    //         `--.____,'|_________,-'

    // when lines are plotted, return
    if (this.checkLinesPlotted) return;

    // create an empty feauture collection of geojson objects
    let featureCollection: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: 'FeatureCollection',
      features: [],
    };

    // get the max number of num_ships
    const shipExt = d3.extent(
      volumes[countryKey]['origins'].map((x) => x.numShips)
    ) as [unknown, unknown] as [number, number]; // MOOOOOOOOOOORe jankyness !!!1!1!11
    // create scale
    const lineScale = d3.scaleLinear().domain(shipExt).range([2, 10]);
    // counter for ids
    let counter = 0;
    let counter2 = 0;

    // go through all origins
    volumes[countryKey]['origins'].forEach((origin) => {
      // Create a new feature
      const feature: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {
          id: 'line-' + counter2++,
          width: lineScale(origin.numShips),
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [volumes[countryKey].lon, volumes[countryKey].lat],
            [origin.lon, origin.lat],
          ],
        },
      };
      // Add the feature to the featurecollection
      featureCollection.features.push(feature);
    });
    if (map.getSource('lines')) map.removeSource('lines');
    // add source to map
    map.addSource('lines', {
      type: 'geojson',
      data: featureCollection,
    });

    // go through feature collection
    featureCollection.features.forEach((feature) => {
      // assemble new id
      let layerId = 'line' + counter++;
      this.layerIds.push(layerId);
      // reset layers and sources
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      // add layer to map
      map.addLayer({
        id: layerId,
        type: 'line',
        source: 'lines',
        filter: ['==', 'id', feature.properties!['id']],
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#73787E',
          'line-opacity': 1,
          'line-width': feature.properties!['width'],
        },
      });
    });
    // set flag that the lines are plotted
    this.checkLinesPlotted = true;
  }

  /**
   * Method for event handling when mouse leaves a path element of piechart
   * @param event of type any. Contains the path element in event.target
   */
  mouseleave(event: any) {
    // reset the opacity of the path element
    d3.select(event.target).style('opacity', 0.7);
    // hide tooltip
    this.toolTip.style('visibility', 'hidden');

    // remove plotted layers
    this.layerIds.forEach((id) => {
      map.removeLayer(id);
    });
    // remove the source
    if (map.getSource('lines')) map.removeSource('lines');

    // reset flag and clear list of layer ids
    this.layerIds = [];
    this.checkLinesPlotted = false;

    this.showPies();
  }

  /**
   * Method to hide all pie charts except one
   * @param chartID id of piechart that is not hidden, i.e. the current piechart that is hovered
   */
  hidePies(chartID: number) {
    // iterate through all popups
    for (const key in this.pieChartPopups) {
      // get the current popup
      const popup = this.pieChartPopups[key];
      // get the corresponding htmlelement
      const htmlpopup = (popup.getElement() as HTMLElement)
        .children[0] as HTMLElement;
      // check if the current popup is the one which shouldnt be hidden
      if (+htmlpopup.id == chartID) {
        // the current popup is the exception
      } else {
        htmlpopup.style.visibility = 'hidden';
      }
    }
  }

  /**
   * Method to show all pie charts
   */
  showPies() {
    // iterate through all popups
    for (const key in this.pieChartPopups) {
      // get the current popup
      const popup = this.pieChartPopups[key];
      // get the corresponding htmlelement
      const htmlpopup = (popup.getElement() as HTMLElement)
        .children[0] as HTMLElement;
      htmlpopup.style.visibility = 'visible';
    }
  }

  showPiechartLegend() {
    this.showPieLegend = !this.showPieLegend;
  }

  /**
   * Method for generating dots on the map which show the amount of arrived and departed ships
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   */
  generateDot(start?: string, end?: string) {
    // show progress bar
    this.showLoadingBar(true);

    // set flag that the visualization is active
    this.portsactive = true;

    //getDotData is a method from apiservice (call backend and return data)
    this.api.getDotData(start, end).subscribe((data) => {
      // hide loading bar
      this.showLoadingBar(false);

      // check if the result is empty
      if (data.length == 0) {
        alert(
          '\n No data entries found for given time range.\n Try choosing a braoder or different date range instead.\n\n Press "okay" to continue'
        );
        return;
      }

      for (const key in data) {
        // retrieve current entry
        const port = data[key];
        // assemble html
        const html: string = port.portname + ': ' + port.count + ' ships';

        // for this entry, create a mapbox popup
        const popup = new mapboxgl.Popup({
          offset: map.getZoom() * 2,
          closeOnClick: false,
          closeButton: false,
          anchor: 'bottom',
        })
          .setLngLat([port.plon, port.plat])
          .setHTML(html)
          .addTo(map);

        // add this popup to all the dot popups
        this.dotPopups.push(popup);

        // set the initial fontsize
        const htmlpopup = (popup.getElement() as HTMLElement)
          .children[1] as HTMLElement;
        htmlpopup.style.fontSize = '3px';
        htmlpopup.style.padding = '3px';

        // background color
        htmlpopup.style.background = 'white';
        (
          (popup.getElement() as HTMLElement).children[0] as HTMLElement
        ).style.borderTopColor = 'white';

        // adjust font size and size of the popup according to zoom event
        map.on('zoomend', () => {
          // get zoom
          const zoom = 2 * map.getZoom();
          // set font size
          htmlpopup.style.fontSize = zoom.toString() + 'px';
          htmlpopup.style.padding = zoom.toString() + 'px';
        });
      }
    });
  }

  /**
   * Method for plotting bar charts on the map
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   */
  generateBar(start?: string, end?: string) {
    // show loading bar
    this.showLoadingBar(true);

    // set flag that the visualization is active
    this.barchartactive = true;

    // if there are markers from the previous call remove these markers
    if (this.barMarkers.length || this.barPopups.length) this.destroyBar();

    // call backend
    this.api.getBarData(start, end).subscribe((data) => {
      // hide loading bar
      this.showLoadingBar(false);

      // check if the result set is empty
      let check = 0;
      for (const key in data) {
        check++;
      }
      if (check == 0) {
        alert(
          '\n No data entries found for given time range.\n Try choosing a braoder or different date range instead.\n\n Press "okay" to continue'
        );
        return;
      }

      // counter for the ids of the d3 bar charts
      let counter = 0;

      // iterate through bar chart data (all bar charts - one per country)
      for (const key in data) {
        // get the current data for one bar chart
        const currBarChartData = data[key];

        // assemble id for this bar chart
        const id = 'chart-' + counter++;

        // for this entry, create a mapbox popup
        const popup = new mapboxgl.Popup({
          offset: 25,
          closeOnClick: false,
          closeButton: false,
          anchor: 'bottom',
          maxWidth: '400px',
        })
          .setLngLat([currBarChartData.lon, currBarChartData.lat])
          .setHTML(`<svg id="${id}"></svg>`)
          .addTo(map);

        // push popup to list of popups
        this.barPopups.push(popup);

        // style popup
        // get html element of popup and set the styling of the popup content
        const htmlpopup = (popup.getElement() as HTMLElement)
          .children[1] as HTMLElement;
        htmlpopup.style.pointerEvents = 'none';
        htmlpopup.style.padding = '15px';

        // get the bar chart and save it to the svg variable. Also set width and height
        const selId = '#' + id;
        var svg = d3.select(selId).attr('width', 300).attr('height', 200);

        // color scale
        const color = d3
          .scaleOrdinal<string>()
          .range([
            '#59C7EB',
            '#586BA4',
            '#A54D69',
            '#0AA398',
            '#FFB8AC',
            '#9AA0A7',
          ]);

        // set height of the drawing
        const height = 100;
        const offset_x = 90;

        // get the min and max distance for this bar chart and trick the typescript type inference
        const boundary = d3.max(
          currBarChartData['bars'].map((x) => x.distance)
        );

        const max_length = d3.max(
          currBarChartData['bars'].map((x) => x.source.length)
        );
        // create boundaries
        const boundaries = [1, (boundary as unknown as number) + 100] as [
          unknown,
          unknown
        ] as [number, number];

        const length_boundaries = [1, max_length as unknown as number] as [
          unknown,
          unknown
        ] as [number, number];

        const min_fontsize = 4;
        const max_fontsize = 13;

        const l = d3
          .scaleLinear()
          .domain(length_boundaries)
          .range([max_fontsize, min_fontsize]);

        // add a y scale
        const y = d3.scaleLog().domain(boundaries).range([height, 0]);

        // // add a x scale
        const x = d3
          .scaleBand()
          .domain(currBarChartData['bars'].map((d) => d.source))
          .range([0, 5 + currBarChartData['bars'].length * 25])
          .padding(0.1);

        // create the bar chart
        svg
          .selectAll('rect')
          .data(currBarChartData['bars'])
          .enter()
          .append('rect')
          .attr('x', (d, i) => 5 + i * 25)
          // .attr('y', (d) => 100)
          .attr('width', 20)
          .attr('id', (d) => d.source)
          .attr('d', (d) => d.distance)
          .attr('height', (d) => height - y(d.distance + 1))
          .attr('fill', (d) => color(d.source))
          .attr(
            'transform',
            (d) =>
              'translate(' + offset_x + ', ' + (y(d.distance + 1) + 30) + ')'
          );

        // add a title
        svg
          .append('text')
          .attr('x', 100)
          .attr('y', 20)
          .attr('text-anchor', 'middle')
          .attr('font-size', '18px')
          .attr('font-weight', '300')
          .text(currBarChartData.country);

        // add the y axis
        svg
          .append('g')
          .call(d3.axisLeft(y))
          .attr('transform', 'translate(' + offset_x + ', 30)')
          .attr('font-size', '8px')
          .call(
            d3
              .axisLeft(y)
              // .tickSize(-200)
              .tickFormat(d3.format('.0s')) // format the tick values
              .tickValues(y.ticks(4).concat(y.domain())) // set the number of desired ticks
          );
        // add the x axis
        svg
          .append('g')
          .call(d3.axisBottom(x))
          .attr('transform', 'translate(' + offset_x + ', 130)')
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('font-size', function (d) {
            if (typeof d == 'string') {
              return l(d.length) + 'px';
            }
            return '6px';
          })
          .attr('dx', '-.8em')
          .attr('dy', '.15em');

        // add a marker at the long lat location its the center of the country
        var marker = new mapboxgl.Marker({ color: '#73787E' })
          .setLngLat([currBarChartData.lon, currBarChartData.lat])
          .setPopup(popup)
          .addTo(map);
        // push onto list of all markers
        this.barMarkers.push(marker);

        // hovering over the marker displays the popup
        marker.getElement().addEventListener('mouseenter', () => {
          popup.addTo(map);
        });

        // when mouse leaves the marker, the popup vanishes
        marker.getElement().addEventListener('mouseleave', () => {
          popup.remove();
        });
      }
    });
  }

  /**
   * Method for deleting heatmap
   */
  resetHeatMap() {
    if (this.unauthorizedChecked) {
      this.checkedUnauthorized = false;
      this.destroyHeatMap(1);
      map.getLayer('unknown') != undefined?map.removeLayer('unknown'):undefined;
      map.getLayer('authorized') != undefined?map.removeLayer('authorized'):undefined;
      map.getSource('unauthorized') != undefined?map.removeSource('unauthorized'):undefined;
      map.getSource('authorized') != undefined?map.removeSource('authorized'):undefined;
  
      this.unauthorizedChecked = false;
    } else if (this.authorizedChecked) {
      this.checkedAuthorized = false;
      this.destroyHeatMap(2);
      map.getLayer('unknown') != undefined?map.removeLayer('unknown'):undefined;
      map.getLayer('authorized') != undefined?map.removeLayer('authorized'):undefined;
      map.getSource('authorized') != undefined?map.removeSource('authorized'):undefined;
      map.getSource('unauthorized') != undefined?map.removeSource('unauthorized'):undefined;
      this.authorizedChecked = false;
    } else {
      if (
        this.authorized_data.length !== 0 &&
        this.unauthorized_data.length !== 0
      ) {
        this.destroyHeatMap(0); // option 0: authorized and unautherized
      } else if (this.authorized_data.length !== 0) {
        this.destroyHeatMap(2);
        map.getLayer('authorized') != undefined?map.removeLayer('authorized'):undefined;
        map.getSource('authorized') != undefined?map.removeSource('authorized'):undefined;
      } else if (this.unauthorized_data.length !== 0) {
        this.destroyHeatMap(1);
        map.getLayer('unknown') != undefined?map.removeLayer('unknown'):undefined;
        map.getSource('unauthorized') != undefined?map.removeSource('unauthorized'):undefined;
      }
    }

    this.encountersChecked = false;

    this.showAuthorizedDisabled = true;
    this.showUnauthorizedDisabled = true;
    this. disabledCountryFilter = true; 
    this.disabledShipFilter = true;
//*  
    this.country_names = [];
    this.ship_names= [];

    this.selected_country = undefined;
    this.selected_ship = undefined;
  }

  /**
   * Method when slider is pressed and a selection shoul happen on the encounters
   * Authorized encounters should only be seen
   * @param event
   */
  showAuthorizedOnly(event: any) {
    if (event.checked) {
      this.authorizedChecked = true;
      this.destroyHeatMap(1); // option 1: destroy only unautherized

      if (this.checkedUnauthorized) {
        this.checkedUnauthorized = false;
        this.unauthorizedChecked = false;
        this.updateHeatMap('authorized');
      }

      this.country_names = this.country_names_authorized;
      this.ship_names = this.ship_names_authorized;

    } else {
      this.authorizedChecked = false;
      this.updateHeatMap('unknown');

      this.country_names = this.country_names_all;
      this.ship_names = this.ship_names_all;
    }

  }

  /**
   * Method when slider is pressed and a selection shoul happen on the encounters
   * Unathorized encounters should only be seen
   * @param event
   */
  showUnauthorizedOnly(event: any) {
    if (event.checked) {

      this.unauthorizedChecked = true;
      this.destroyHeatMap(2); // option 2: destroy only autherized

      if (this.checkedAuthorized) {
        this.checkedAuthorized = false;
        this.authorizedChecked = false;
        this.updateHeatMap('unknown');
      }

      this.country_names = this.country_names_unauthorized;
      this.ship_names = this.ship_names_unauthorized;

    } else {
      
      this.unauthorizedChecked = false;
      this.updateHeatMap('authorized');

      this.country_names = this.country_names_all;
      this.ship_names = this.ship_names_all;
    }
  }

  /**
   * Method for generating a heatmap on the map
   * @param start start date (YYYY-MM-DD)
   * @param end end date (YYYY-MM-DD)
   */
  generateHeatMap(start?: string, end?: string) {

    // is a method from apiservice (call backend and return data)
    // subscribe is similar to: call backend and wait until it is finished and then put returned data into arguments
    if (!this.request_data_once) {

      this.showLoadingBar(true);
      this.api.getHeatMapData(start, end).subscribe((data) => {
       //*
        this.showLoadingBar(false);
  
        this.authorized_data = data[0];
        this.unauthorized_data = data[1];

        this.country_names_authorized = data[2].sort();
        this.ship_names_authorized = data[3].sort();
        this.country_names_unauthorized = data[4].sort();
        this.ship_names_unauthorized = data[5].sort();

        this.country_names_all = data[6].sort();
        this.ship_names_all = data[7].sort();

        if (
          this.authorized_data.length !== 0 &&
          this.unauthorized_data.length !== 0
        ) {
          // prepare data for heatmap layer
          // convert data into geojson
          // add mapbox circle layer
          // add hover event to circles

          this.createAuthorizedLayer();
          this.addAuthorizedHover();

          this.createUnauthorizedLayer();
          this.addUnauthorizedHover();

          this.showAuthorizedDisabled = false;
          this.showUnauthorizedDisabled = false;
//*
          this.country_names = this.country_names_all;
          this.ship_names = this.ship_names_all;
          this.disabledCountryFilter = false; 
          this.disabledShipFilter = false;

          this.request_data_once = true;
        } else if (
          this.unauthorized_data.length == 0 &&
          this.authorized_data.length == 0
        ) {
          alert(
            '\n No data entries found for given time range.\n Try choosing a braoder or different date range instead.\n\n Press "okay" to continue'
          );
        } else if (this.authorized_data.length !== 0) {
          this.createAuthorizedLayer();
          this.addAuthorizedHover();

          this.country_names = this.country_names_authorized;
          this.ship_names = this.ship_names_authorized;
          this.disabledCountryFilter = false; 
          this.disabledShipFilter = false;

          this.request_data_once = true;
        } else if (this.unauthorized_data.length !== 0) {
          this.createUnauthorizedLayer();
          this.addUnauthorizedHover();

          this.country_names = this.country_names_unauthorized;
          this.ship_names = this.ship_names_unauthorized;
          this.disabledCountryFilter = false; 
          this.disabledShipFilter = false;

          this.request_data_once = true;
        }
      });
    } else {
      // data is already available
      if (
        this.authorized_data.length !== 0 &&
        this.unauthorized_data.length !== 0
      ) {
        this.createAuthorizedLayer();
        this.createUnauthorizedLayer();

        this.country_names = this.country_names_all;
        this.ship_names = this.ship_names_all;

        this.disabledCountryFilter = false; 
        this.disabledShipFilter = false;
        this.disabledCountryFilter = false; 
        this.disabledShipFilter = false;

        this.showAuthorizedDisabled = false;
        this.showUnauthorizedDisabled = false;
      } else if (this.authorized_data.length !== 0) {
        this.createAuthorizedLayer();
        this.country_names = this.country_names_authorized;
        this.ship_names = this.ship_names_authorized;
        this. disabledCountryFilter = false; 
        this.disabledShipFilter = false;
      } else if (this.unauthorized_data.length !== 0) {
        this.createUnauthorizedLayer();
        this.country_names = this.country_names_unauthorized;
        this.ship_names = this.ship_names_unauthorized;
        this. disabledCountryFilter = false; 
        this.disabledShipFilter = false;
      }
    }
  }

  /**
   * Method for adding a layer to the mapbox component for authorized encounters
   */
  createAuthorizedLayer() {
    let geojson_authorized_data = this.convertToGeojson(this.authorized_data);
//*
    map.addSource('authorized', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: geojson_authorized_data },
    });

    map.addLayer({
      id: 'authorized',
      type: 'circle',
      source: 'authorized',
      //filter: ["==", ["get", "category"], 0],
      paint: {
        'circle-radius': {
          type: 'identity',
          property: 'radius',
        },
        'circle-opacity': 0.2,
        'circle-color': ' #229954 ', //green
        'circle-stroke-width': 1,
        'circle-stroke-color': 'black',
      },
    });
  }

  /**
   * Method for adding a mouseover effect on an authorized encounter point
   */
  addAuthorizedHover() {
    let tooltip_authorized: any;

    map.on('mouseover', 'authorized', function (e) {
      let features: any = e.features;
      let properties = features[0].properties;
      let coordinates = features[0].geometry.coordinates;

      tooltip_authorized = new mapboxgl.Popup({
        closeOnClick: false,
        closeButton: false,
      })
        .setHTML(
          `<b>${properties.cname}</b> <br> From: ${properties.cfrom} (${properties.cpfrom}) <br>  To: ${properties.cto} (${properties.cpto}) <br>
        <b>${properties.fname}</b> <br> From: ${properties.ffrom} (${properties.fpfrom}) <br> To: ${properties.fto} (${properties.fpto})`
        )
        .setLngLat(coordinates)
        .addTo(map);
    });

    map.on('mouseleave', 'authorized', () => {
      tooltip_authorized.remove();
    });
  }

  /**
   * Method for adding a layer to the mapbox component for unauthorized encounters
   */
  createUnauthorizedLayer() {
    let geojson_unauthorized_data = this.convertToGeojson(
      this.unauthorized_data
    );

    map.addSource('unauthorized', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: geojson_unauthorized_data },
    });

    map.addLayer({
      id: 'unknown',
      type: 'circle',
      source: 'unauthorized',
      //filter: ["==", ["get", "category"], 1],
      paint: {
        'circle-radius': {
          type: 'identity',
          property: 'radius',
        },
        'circle-opacity': 0.2,
        'circle-color': ' #c0392b ', //red
        'circle-stroke-width': 1,
        'circle-stroke-color': 'black',
      },
    });
  }

  /**
   * Method for adding a mouseover effect on an unauthorized encounter point
   */
  addUnauthorizedHover() {
    let tooltip_unauthorized: any;

    map.on('mouseover', 'unknown', function (e) {
      let features: any = e.features;
      let properties = features[0].properties;
      let coordinates = features[0].geometry.coordinates;

      tooltip_unauthorized = new mapboxgl.Popup({
        closeOnClick: false,
        closeButton: false,
      })
        .setHTML(
          `<b>${properties.cname}</b> <br> From: ${properties.cfrom} (${properties.cpfrom}) <br>  To: ${properties.cto} (${properties.cpto}) <br>
        <b>${properties.fname}</b> <br> From: ${properties.ffrom} (${properties.fpfrom}) <br> To: ${properties.fto} (${properties.fpto})`
        )
        .setLngLat(coordinates)
        .addTo(map);
    });

    map.on('mouseleave', 'unknown', () => {
      tooltip_unauthorized.remove();
    });
  }

  /**
   * Update the heatmap based on selecting only autherized or unkown
   * @param string authorized or unauthorized
   */
  updateHeatMap(option: string) {
    if (option === 'authorized' && map.getLayer('authorized') == undefined) {
      map.addLayer({
        id: 'authorized',
        type: 'circle',
        source: 'authorized',
        //filter: ["==", ["get", "category"], 0],
        paint: {
          'circle-radius': {
            type: 'identity',
            property: 'radius',
          },
          'circle-opacity': 0.5,
          'circle-color': ' #229954 ', //green
          'circle-stroke-width': 1,
          'circle-stroke-color': 'black',
        },
      });
    } else if (option === 'unknown' && map.getLayer('unknown') == undefined) {
      map.addLayer({
        id: 'unknown',
        type: 'circle',
        source: 'unauthorized',
        //filter: ["==", ["get", "category"], 1],
        paint: {
          'circle-radius': {
            type: 'identity',
            property: 'radius',
          },
          'circle-opacity': 0.5,
          'circle-color': '#c0392b ', // red
          'circle-stroke-width': 1,
          'circle-stroke-color': 'black',
        },
      });
    }
  }

  applyFilter(){
    //*
    const startString = this.range.value.start;
    const endString = this.range.value.end;
    let start: string | undefined;
    let end: string | undefined;
    
    if (
      startString == null ||
      startString == undefined ||
      endString == undefined ||
      endString == null
    ) {
      start = undefined;
      end = undefined;
    } else {
      start = this.dateToStr(startString);
      end = this.dateToStr(endString);
    }

    let keyword1 = this.selected_country===undefined||this.selected_country==="none"?"none":this.selected_country;
    let keyword2 = this.selected_ship===undefined||this.selected_ship==="none"?"none":this.selected_ship;

    this.showLoadingBar(true);
    
    this.api.getHeatMapDataFilter(start, end, keyword1, keyword2).subscribe((data) => {
      this.showLoadingBar(false);

      this.authorized_data = data[0];
      this.unauthorized_data = data[1];

      this.ship_names = data[2].sort();

      // if both list are empty then there was no data of country-ship combination
      // reset ship value and query just for the country
      if(this.authorized_data.length == 0 && this.unauthorized_data.length == 0 ){
        this.selected_ship = 'none';
        //this.ship_names = [];
        this.applyFilter();
      }

      this.destroyHeatMap(0);
      this.createAuthorizedLayer();
      this.createUnauthorizedLayer();

      if (this.authorized_data.length != 0 && this.unauthorized_data.length == 0){

        this.checkedAuthorized = true;
        this.authorizedChecked = true;
        this.ship_names_authorized = this.ship_names;
        this.showAuthorizedOnly({"checked": true});
        this.checkedUnauthorized = false;
        this.unauthorizedChecked = false;
        this.showUnauthorizedDisabled = true;
        this.showAuthorizedDisabled = false;

      }
      else if (this.unauthorized_data.length != 0 && this.authorized_data.length == 0 ){

        this.checkedUnauthorized = true;
        this.unauthorizedChecked = true;
        this.ship_names_unauthorized = this.ship_names;
        this.showUnauthorizedOnly({"checked": true});
        this.checkedAuthorized = false;
        this.authorizedChecked = false;
        this.showUnauthorizedDisabled = false;
        this.showAuthorizedDisabled = true;
         
      }else{

        this.checkedAuthorized = false;
        this.authorizedChecked = false;
        this.checkedUnauthorized = false;
        this.unauthorizedChecked = false;
        this.showUnauthorizedDisabled = false;
        this.showAuthorizedDisabled = false;

      }     
    });    
  }

  /**
   * Destroy pie charts on the visualization
   */
  destroyPie() {
    // iterate through list of created popups and call remove() method
    this.pieChartPopups.forEach((popup) => {
      popup.remove();
    });
    this.pieChartPopups = [];
    this.piechartactive = false;

    // hide button for legend
    this.showPieLegendButton = false;
    if (this.showPieLegend) this.showPieLegend = !this.showPieLegend;
  }

  /**
   * Destroy dots on the visualization
   */
  destroyDot() {
    this.dotPopups.forEach((popup) => {
      popup.remove();
    });
    this.dotPopups = [];
    this.portsactive = false;
  }

  /**
   * Destroy bars on the visualization
   */
  destroyBar() {
    // remove markers
    this.barMarkers.forEach((marker) => {
      marker.remove();
    });
    // remove popups
    this.barPopups.forEach((popup) => {
      popup.remove();
    });
    // clear lists
    this.barMarkers = [];
    this.barPopups = [];

    this.barchartactive = false;
  }
//*
  /**
   * Destroy heatmap on the map
   * @param option of type number 0=authorized and unauthorized encounters, 1=unknown, 2=authorized
   */
  destroyHeatMap(option: any) {
    if (option === 0) {
      map.getLayer('authorized') != undefined?map.removeLayer('authorized'):undefined;
      map.getLayer('unknown') != undefined?map.removeLayer('unknown'):undefined;
      map.getSource('authorized') != undefined?map.removeSource('authorized'):undefined;
      map.getSource('unauthorized') != undefined?map.removeSource('unauthorized'):undefined;
    } else if (option === 1) {
      map.getLayer('unknown') != undefined?map.removeLayer('unknown'): undefined;
    } else if (option === 2) {
      map.getLayer('authorized') != undefined?map.removeLayer('authorized'): undefined;
    }

    // map.removeSource("data");
  }

  // ************************************ Other methods ************************************

  /**
   * Method for showing/hiding loading bar
   * @param boolean show true or false
   */
  showLoadingBar(show: boolean) {
    this.pieChartDisabled = show;
    this.encounterDisabled = show;
    this.barChartDisabled = show;
    this.portDisabled = show;
    this.rangeDisabled = show;
    this.isLoading = show;
  }

  // ------------------ Useful Methods -------------------------
  /**
   * Method for parsing a date to a string
   * @param d date
   */
  dateToStr(d: Date) {
    return (
      d.getFullYear() +
      '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + d.getDate()).slice(-2)
    );
  }

  /**
   * Converts data to geojson format
   * @param data of any type
   * @returns
   */
  convertToGeojson(data: any) {
    return data.map(
      (d: {
        fpfrom: any;
        fpto: any;
        cpto: any;
        cpfrom: any;
        long: any;
        lat: any;
        status: any;
        cname: any;
        cfrom: any;
        cto: any;
        fname: any;
        ffrom: any;
        fto: any;
      }) => {
        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [d.long, d.lat],
          },
          properties: {
            category: d.status, // needed for color assignment in the paint option
            cname: d.cname, // name of carrier
            cfrom: d.cfrom, // carrier country  from
            cto: d.cto, // carrier country to
            cpfrom: d.cpfrom, // carrier port name from
            cpto: d.cpto, // carrier port name to
            fname: d.fname, // name of fishing
            ffrom: d.ffrom, // fishing country from
            fto: d.fto, // fishing country to
            fpto: d.fpto, // fishing country to
            fpfrom: d.fpfrom, // fishing port name from
          },
        };
      }
    );
  }
}
