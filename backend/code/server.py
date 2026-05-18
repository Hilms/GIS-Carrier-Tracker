from flask import Flask, jsonify, request
from flask_cors import CORS

import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)
CORS(app)


@app.route('/')
def home():
    return 'This shows that the server is running'


# ------------------------------------ Pie Chart ------------------------------------
@app.route('/pieData', methods=["GET"])
def getPieData():
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)

    query = """
        WITH CTE AS (
        SELECT c1.country as "port.country", c2.country as "vessel.flag", count(*) as "num_ships",
                row_number() OVER (PARTITION BY c1.country ORDER BY count(*) DESC) as rn
        FROM port p
        JOIN countrycodes c1 ON p."port.country" = c1.code
        JOIN countrycodes c2 ON p."vessel.flag" = c2.code
        WHERE date("start") between %s and %s and date("end") between %s and %s and "port.name" <> ''
        GROUP BY c1.country, c2.country)
        SELECT "port.country", c1.lat, c1.lon, c1.area,
            CASE WHEN rn <= 5 THEN "vessel.flag" ELSE 'Other' END as "vessel.flag",
            SUM("num_ships") as "num_ships"
        FROM CTE
        JOIN countrycodes c1 ON cte."port.country" = c1.country
        GROUP BY "port.country", c1.lat, c1.lon, c1.area, 
                CASE WHEN rn <= 5 THEN "vessel.flag" ELSE 'Other' END
        ORDER BY "port.country", "num_ships" DESC;
    """

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        query = cursor.mogrify(query, (start, end, start, end))
        cursor.execute(query)
        results = cursor.fetchall()

    data = []

    for r in results:
        data.append({
            "country": r['port.country'],
            "lat": r['lat'],
            "lon": r['lon'],
            "area": r['area'],
            "share": r['vessel.flag'],
            "ships": r['num_ships']
        })

    # prepare return data
    rData = {}

    # Create a mapping from country to number
    country_mapping = {entry['country']: i for i, entry in enumerate(data)}

    # group data
    for entry in data:
        key = country_mapping[entry['country']]
        if key not in rData:
            rData[key] = {
                'country': entry['country'],
                'lat': entry['lat'],
                'lon': entry['lon'],
                'area': entry['area'],
                'shares': [],
                'origins': []
            }
        rData[key]['shares'].append(
            {'share': entry['share'], 'ships': entry['ships']})

    for country in rData:
        cData = rData[country]
        ships = 0
        for share in cData['shares']:
            ships += share['ships']
        cData['allShips'] = ships

    query = """
        select c1.country as pcountry, c1.lon as plon, c1.lat as plat, c2.country, c2.lon, c2.lat, count(*) as num_ships
        from port p
        JOIN countrycodes c1 ON p."port.country" = c1.code
        JOIN countrycodes c2 ON p."vessel.flag" = c2.code
        WHERE date(p."start") between %s and %s and date(p."end") between %s and %s and p."port.name" <> ''
        group BY c1.country, c1.lon, c1.lat, c2.country, c2.lon, c2.lat
        order by c1.country, c2.country;
    """

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        query = cursor.mogrify(query, (start, end, start, end))
        cursor.execute(query)
        results = cursor.fetchall()

    for r in results:
        country = r['pcountry']
        for d in rData:
            if rData[d]['country'] == country:
                rData[d]['origins'].append(
                    {'country': r['country'], 'numShips': r['num_ships'], 'lon': r['lon'], 'lat': r['lat']})

    return jsonify(rData), 200


# ------------------------------------ Dots per port ------------------------------------
@app.route('/dotData', methods=["GET", "POST"])
def getDotData():
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)

    query = """
    select "port.name", countrycodes.country as "port.country", count(*), avg("port.lat") as "plat", avg("port.lon") as "plon"
    from port
    join countrycodes 
    on "port.country" = countrycodes.code
    where 
    date("start") between %s and %s and date("end") between %s and %s and "port.name" <> ''
    group by "port.name", countrycodes.country;
    """

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        query = cursor.mogrify(query, (start, end, start, end))
        cursor.execute(query)
        results = cursor.fetchall()

    data = []

    for r in results:
        data.append({
            "portname": r['port.name'],
            "country": r['port.country'],
            "count": r['count'],
            "plat": r['plat'],
            "plon": r['plon']
        })

    return jsonify(data), 200


# ------------------------------------ Bar Chart ------------------------------------
@app.route('/barChartData', methods=["GET", "POST"])
def getBarChartData():
    # create connection
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)

    # create query
    query = """
            WITH top_5_countries AS (
            SELECT destination_country, origin_country, total_distance_km,
                ROW_NUMBER() OVER (PARTITION BY destination_country ORDER BY total_distance_km DESC) as row_num
            FROM (
                SELECT  c2.country as destination_country, c1.country as origin_country,
                    SUM(ST_DistanceSphere(ST_MakePoint(c1.lon, c1.lat), ST_MakePoint(c2.lon, c2.lat))/ 1000) as total_distance_km
                FROM loitering l
                JOIN countrycodes c1 ON l."vessel.origin_port.country" = c1.code
                JOIN countrycodes c2 ON l."vessel.destination_port.country" = c2.code
                WHERE date(l."start") between %s and %s and date(l."end") between %s and %s
                GROUP BY c2.country, c1.country
            ) subquery
        )
        select t.destination_country as country, t.origin_country as origin, t.total_distance_km as dist, c1.lon as dlon, c1.lat as dlat, c2.lon as olon, c2.lat as olat
        from top_5_countries t
        join countrycodes c1 on t.destination_country = c1.country 
        join countrycodes c2 on t.origin_country = c2.country
        where t.row_num <= 5
        order by country, dist desc;
    """

    # perform query
    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        query = cursor.mogrify(query, (start, end, start, end))
        cursor.execute(query)
        results = cursor.fetchall()

    data = []

    # append results to data
    for r in results:
        data.append({
            "country": r['country'],
            "origin": r['origin'],
            "dist": r['dist'],
            "dlon": r['dlon'],
            "dlat": r['dlat'],
            "olon": r['olon'],
            "olat": r['olat']
        })

    # group data by destination country
    rData = {}

    # Create a mapping from country to number
    country_mapping = {entry['country']: i for i, entry in enumerate(data)}

    # group data
    for entry in data:
        key = country_mapping[entry['country']]
        if key not in rData:
            rData[key] = {
                'country': entry['country'],
                'lat': entry['dlat'],
                'lon': entry['dlon'],
                'bars': []
            }
        rData[key]['bars'].append(
            {'source': entry['origin'], 'distance': entry['dist'], 'slon': entry['olon'], 'slat': entry['olat']})

    return jsonify(rData), 200


# ------------------------------------ get encounters for heatmap ------------------------------------
@app.route('/heatMapData', methods=["GET", "POST"])
def getHeatMapData():
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)

    data = []
    authorized = []
    unauthorized = []

    authorizedShips = []
    authorizedCountries =[]

    unauthorizedCountries = []
    unauthorizedShips = []

    allCountries =[]
    allShips =[]

    queryAutherized = """
    SELECT e."vessel.name" AS carrier, 
        c1.country AS cfrom, 
        c2.country AS cto, 
        e."vessel.origin_port.name" AS cpfrom,
        e."vessel.destination_port.name" AS cpto,
        e."encounter.encountered_vessel.name" AS fishing, 
        c3.country AS ffrom, 
        c4.country AS fto,
        e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
        e."encounter.encountered_vessel.destination_port.name" AS fpto,
        e.lat AS lat,
        e.lon AS long
    FROM encounter AS e
    JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
    JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
    JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
    JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'authorized'
    """.format(start_date=start, end_date=end)

    queryUnautherized = """
    SELECT e."vessel.name" AS carrier,
        c1.country AS cfrom,
        c2.country AS cto,
        e."vessel.origin_port.name" AS cpfrom,
        e."vessel.destination_port.name" AS cpto,
        e."encounter.encountered_vessel.name" AS fishing,
        c3.country AS ffrom,
        c4.country AS fto,
        e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
        e."encounter.encountered_vessel.destination_port.name" AS fpto,
        e.lat AS lat,
        e.lon AS long
    FROM encounter AS e
    JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
    JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
    JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
    JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'unknown'
    """.format(start_date=start, end_date=end)


    queryCountriesAuthorized = """
    SELECT DISTINCT unnest(array[c1.country, c2.country, c3.country, c4.country ]) AS "country"
    FROM encounter AS e
    JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
    JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
    JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
    JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'authorized'
    """.format(start_date=start, end_date=end)

    queryShipsAuthorized = """
    SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name" ]) AS "ship"
    FROM encounter AS e
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'authorized'
    """.format(start_date=start, end_date=end)

    queryCountriesUnauthorized = """
    SELECT DISTINCT unnest(array[c1.country, c2.country, c3.country, c4.country ]) AS country
    FROM encounter AS e
    JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
    JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
    JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
    JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'unknown'
    """.format(start_date=start, end_date=end)

    queryShipsUnauthorized = """
    SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name" ]) AS ship
    FROM encounter AS e
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" = 'unknown'
    """.format(start_date=start, end_date=end)


    queryAllCountries = """
    SELECT DISTINCT unnest(array[c1.country, c2.country, c3.country, c4.country ]) AS country
    FROM encounter AS e
    JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
    JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
    JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
    JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
    """.format(start_date=start, end_date=end)


    queryAllShips = """
    SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name" ]) AS ship
    FROM encounter AS e
    WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND e."encounter.authorization_status" <> 'partial'
    """.format(start_date=start, end_date=end)


    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
    
        cursor.execute(queryAutherized)
        resultsAutherized = cursor.fetchall()

        cursor.execute(queryUnautherized)
        resultsUnautherized = cursor.fetchall()

        # authorized country names
        cursor.execute(queryCountriesAuthorized)
        resultsCountriesAuthorized = cursor.fetchall()
        # authorized ship names
        cursor.execute(queryShipsAuthorized)
        resultsShipsAuthorized = cursor.fetchall()
        # unauthorized country names
        cursor.execute(queryCountriesUnauthorized)
        resultsCountriesUnauthorized = cursor.fetchall()
        # unauthorized ship names
        cursor.execute(queryShipsUnauthorized)
        resultsShipsUnauthorized = cursor.fetchall()

        # all country names
        cursor.execute(queryAllCountries)
        resultsAllCountries = cursor.fetchall()
        # all ship names
        cursor.execute(queryAllShips)
        resultsAllShips = cursor.fetchall()

    for r in resultsAutherized:
        authorized.append({
            "cname": r['carrier'],
            "cfrom": r['cfrom'],
            "cto": r['cto'],
            "cpfrom": r['cpfrom'],
            "cpto": r['cpto'],
            "fname": r['fishing'],
            "ffrom": r['ffrom'],
            "fto": r['fto'],
            "fpfrom": r['fpfrom'],
            "fpto": r['fpto'],
            "lat": r['lat'],
            "long": r['long'],
            "status": 1  # authorized
        })

    data.append(authorized)

    for r in resultsUnautherized:
        unauthorized.append({
            "cname": r['carrier'],
            "cfrom": r['cfrom'],
            "cto": r['cto'],
            "cpfrom": r['cpfrom'],
            "cpto": r['cpto'],
            "fname": r['fishing'],
            "ffrom": r['ffrom'],
            "fto": r['fto'],
            "fpfrom": r['fpfrom'],
            "fpto": r['fpto'],
            "lat": r['lat'],
            "long": r['long'],
            "status": 0  # unauthorized
        })

    data.append(unauthorized)

    for r in resultsCountriesAuthorized:
        authorizedCountries.append(r['country'])

    for r in resultsShipsAuthorized:
        authorizedShips.append(r['ship'])
    
    for r in resultsCountriesUnauthorized:
        unauthorizedCountries.append(r['country'])
    
    for r in resultsShipsUnauthorized:
        unauthorizedShips.append(r['ship'])

    for r in resultsAllCountries:
        allCountries.append(r['country'])

    for r in resultsAllShips:
        allShips.append(r['ship'])

    data.append(authorizedCountries)
    data.append(authorizedShips)
    data.append(unauthorizedCountries)
    data.append(unauthorizedShips)
    data.append(allCountries)
    data.append(allShips)
        
    return jsonify(data), 200


@app.route('/heatMapDataFilter', methods=["GET", "POST"])
def getHeatMapDataFilter():
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)
    keyword1 = request.args.get("keyword1", None, type=str) # country name
    keyword2 = request.args.get("keyword2", None, type=str) # ship name
    #slider1 = request.args.get("slider1", None, type=str) # authorized slider checked
    #slider2 = request.args.get("slider2", None, type=str) # unauthorized slider checked

    data = []
    queryFilterAuthorized =""
    queryFilterUnauthorized =""
    authorized = []
    unauthorized = []
    allShips =[]

    if(keyword1 == 'none' and keyword2 == 'none'):

        queryFilterAuthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'authorized'
                """.format(start_date=start, end_date=end)

        queryFilterUnauthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'unknown'
                """.format(start_date=start, end_date=end)

        queryAllShips = """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name" ]) AS ship
        FROM encounter AS e
        WHERE date(e.start) >= '{start_date}'
            AND date(e."end") <= '{end_date}'
            AND e."encounter.authorization_status" <> 'partial'
        """.format(start_date=start, end_date=end)
            

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        
            cursor.execute(queryFilterAuthorized)
            resultsFilterAuthorized = cursor.fetchall()
                
            cursor.execute(queryFilterUnauthorized)
            resultsFilterUnauthorized = cursor.fetchall()

            # all ship names
            cursor.execute(queryAllShips)
            resultsAllShips = cursor.fetchall()

    
        for r in resultsFilterAuthorized:
            authorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 1  # authorized
            })

        data.append(authorized)

        for r in resultsFilterUnauthorized:
            unauthorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 0  # unauthorized
            })
        data.append(unauthorized)

        for r in resultsAllShips:
            allShips.append(r['ship'])

        data.append(allShips)

    elif(keyword1 != 'none' and keyword2 == 'none'):

        queryFilterAuthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'authorized'
                    AND (c1.country = '{country}' OR c2.country='{country}' OR c3.country = '{country}' OR c4.country = '{country}')
                """.format(start_date=start, end_date=end, country=keyword1)

        queryFilterUnauthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'unknown'
                    AND (c1.country = '{country}' OR c2.country='{country}' OR c3.country = '{country}' OR c4.country = '{country}')
                """.format(start_date=start, end_date=end, country=keyword1)
                
        queryAllShips = """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name"]) AS ship
        FROM encounter e
        JOIN countrycodes c ON c.code IN (e."vessel.origin_port.country", e."vessel.destination_port.country", e."encounter.encountered_vessel.origin_port.country", e."encounter.encountered_vessel.destination_port.country")
        WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND c.country = '{country}'
        """.format(start_date=start, end_date=end, country=keyword1); 

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        
            cursor.execute(queryFilterAuthorized)
            resultsFilterAuthorized = cursor.fetchall()
                
            cursor.execute(queryFilterUnauthorized)
            resultsFilterUnauthorized = cursor.fetchall()

            # all ship names
            cursor.execute(queryAllShips)
            resultsAllShips = cursor.fetchall()

    
        for r in resultsFilterAuthorized:
            authorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 1  # authorized
            })

        data.append(authorized)

        for r in resultsFilterUnauthorized:
            unauthorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 0  # unauthorized
            })
        data.append(unauthorized)

        for r in resultsAllShips:
            allShips.append(r['ship'])

        data.append(allShips)

    elif(keyword1 == 'none' and keyword2 != 'none'):

        queryFilterAuthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'authorized'
                    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name"  = '{ship}')
                """.format(start_date=start, end_date=end, ship=keyword2)

        queryFilterUnauthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'unknown'
                    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name"  = '{ship}')
                """.format(start_date=start, end_date=end, ship=keyword2)

        queryAllShips = """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name" ]) AS ship
        FROM encounter AS e
        WHERE date(e.start) >= '{start_date}'
            AND date(e."end") <= '{end_date}'
            AND e."encounter.authorization_status" <> 'partial'
        """.format(start_date=start, end_date=end)
            

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        
            cursor.execute(queryFilterAuthorized)
            resultsFilterAuthorized = cursor.fetchall()
                
            cursor.execute(queryFilterUnauthorized)
            resultsFilterUnauthorized = cursor.fetchall()

            # all ship names
            cursor.execute(queryAllShips)
            resultsAllShips = cursor.fetchall()

    
        for r in resultsFilterAuthorized:
            authorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 1  # authorized
            })

        data.append(authorized)

        for r in resultsFilterUnauthorized:
            unauthorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 0  # unauthorized
            })
        data.append(unauthorized)

        for r in resultsAllShips:
            allShips.append(r['ship'])

        data.append(allShips)

    elif(keyword1 != 'none' and keyword2 != 'none'):

        queryFilterAuthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'authorized'
                    AND (c1.country = '{country}' OR c2.country='{country}'OR c3.country = '{country}' OR c4.country = '{country}')
                    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name"  = '{ship}')
                """.format(start_date=start, end_date=end, country=keyword1, ship=keyword2)

        queryFilterUnauthorized = """
                SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'unknown'
                    AND (c1.country = '{country}' OR c2.country='{country}'OR c3.country = '{country}' OR c4.country = '{country}')
                    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name"  = '{ship}')               
                """.format(start_date=start, end_date=end, country=keyword1, ship=keyword2)

        queryAllShips = """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name"]) AS ship
        FROM encounter e
        JOIN countrycodes c ON c.code IN (e."vessel.origin_port.country", e."vessel.destination_port.country", e."encounter.encountered_vessel.origin_port.country", e."encounter.encountered_vessel.destination_port.country")
        WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND c.country = '{country}'
        """.format(start_date=start, end_date=end, country=keyword1); 

        with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        
            cursor.execute(queryFilterAuthorized)
            resultsFilterAuthorized = cursor.fetchall()
                
            cursor.execute(queryFilterUnauthorized)
            resultsFilterUnauthorized = cursor.fetchall()

            # all ship names
            cursor.execute(queryAllShips)
            resultsAllShips = cursor.fetchall()

    
        for r in resultsFilterAuthorized:
            authorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 1  # authorized
            })

        data.append(authorized)

        for r in resultsFilterUnauthorized:
            unauthorized.append({
                "cname": r['carrier'],
                "cfrom": r['cfrom'],
                "cto": r['cto'],
                "cpfrom": r['cpfrom'],
                "cpto": r['cpto'],
                "fname": r['fishing'],
                "ffrom": r['ffrom'],
                "fto": r['fto'],
                "fpfrom": r['fpfrom'],
                "fpto": r['fpto'],
                "lat": r['lat'],
                "long": r['long'],
                "status": 0  # unauthorized
            })
        data.append(unauthorized)

        for r in resultsAllShips:
            allShips.append(r['ship'])

        data.append(allShips)
        
    return jsonify(data), 200





@app.route('/test', methods=["GET", "POST"])
def getTest():
    connection = psycopg2.connect(
        host="database", port=5432, dbname="gis_db", user="gis_user", password="gis_pass")

    # second parameter is the default value
    start = request.args.get("start", "2012-01-01", type=str)
    end = request.args.get("end", "2022-12-31", type=str)

    '''  query= """
            SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name"]) AS ship
    FROM encounter e
    JOIN countrycodes c ON c.code IN (e."vessel.origin_port.country", e."vessel.destination_port.country", e."encounter.encountered_vessel.origin_port.country", e."encounter.encountered_vessel.destination_port.country")
    WHERE date(e.start) >= '{start_date}'
    AND date(e."end") <= '{end_date}'
    AND c.country = '{country}'
    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name" = '{ship}')

    """.format(start_date=start, end_date=end, country='Turkiye', ship='AKEMI')'''

    '''query= """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name"]) AS ship
        FROM encounter e
        JOIN countrycodes c ON c.code IN (e."vessel.origin_port.country", e."vessel.destination_port.country", e."encounter.encountered_vessel.origin_port.country", e."encounter.encountered_vessel.destination_port.country")
        WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND c.country = '{country}'
        """.format(start_date=start, end_date=end, country='Turkiye')'''

    '''query="""
    SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    AND e."encounter.authorization_status" = 'authorized'
                    AND (e."vessel.name" like '%{ship}%' OR e."encounter.encountered_vessel.name"  like '%{ship}%')
                
        """.format(start_date=start, end_date=end, ship='AGNES 108')'''

    '''query="""
        SELECT e."vessel.name" AS carrier, 
                    c1.country AS cfrom, 
                    c2.country AS cto, 
                    e."vessel.origin_port.name" AS cpfrom,
                    e."vessel.destination_port.name" AS cpto,
                    e."encounter.encountered_vessel.name" AS fishing, 
                    c3.country AS ffrom, 
                    c4.country AS fto,
                    e."encounter.encountered_vessel.origin_port.name" AS fpfrom,
                    e."encounter.encountered_vessel.destination_port.name" AS fpto,
                    e.lat AS lat,
                    e.lon AS long,
                   e."encounter.authorization_status" as okl
                FROM encounter AS e
                JOIN countrycodes AS c1 on c1.code = e."vessel.origin_port.country"
                JOIN countrycodes AS c2 on c2.code = e."vessel.destination_port.country"
                JOIN countrycodes AS c3 on c3.code = e."encounter.encountered_vessel.origin_port.country"
                JOIN countrycodes AS c4 on c4.code = e."encounter.encountered_vessel.destination_port.country"
                WHERE date(e.start) >= '{start_date}'
                    AND date(e."end") <= '{end_date}'
                    
                    AND (e."vessel.name" = '{ship}' OR e."encounter.encountered_vessel.name" = '{ship}')
                
        """.format(start_date=start, end_date=end, ship='AGNES 108')'''

    query = """
        SELECT DISTINCT unnest(array[e."vessel.name", e."encounter.encountered_vessel.name"]) AS ship
        FROM encounter e
        JOIN countrycodes c ON c.code IN (e."vessel.origin_port.country", e."vessel.destination_port.country", e."encounter.encountered_vessel.origin_port.country", e."encounter.encountered_vessel.destination_port.country")
        WHERE date(e.start) >= '{start_date}'
        AND date(e."end") <= '{end_date}'
        AND c.country = '{country}'
        """.format(start_date='2022-10-01', end_date='2022-10-31', country='Turkiye'); 

        
 


  

    with connection.cursor(cursor_factory=RealDictCursor) as cursor:
        #queryAutherized = cursor.mogrify(queryAutherized, (start, end, start, end))
        # logging.error(queryAutherized)
        cursor.execute(query)
        result = cursor.fetchall()
        

    

    return jsonify(result), 200
