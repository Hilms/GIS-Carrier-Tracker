# specify base image that we want to extend
FROM postgis/postgis:latest

# set environment variables that we want to change
ENV POSTGRES_DB="gis_db"
ENV POSTGRES_USER="gis_user"
ENV POSTGRES_PASSWORD="gis_pass"

RUN apt-get update

COPY ./import/dump.sql /docker-entrypoint-initdb.d/dump.sql
