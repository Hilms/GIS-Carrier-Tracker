# base image
FROM node:lts-buster

# app target location
ENV APP_DIR=/var/opt/gis
ENV NG_CLI_ANALYTICS=false

# requirements first to use build caching
RUN mkdir -p ${APP_DIR}
WORKDIR ${APP_DIR}

# copy code
COPY ./jact/ ${APP_DIR}

# run ng serve
RUN npm install

CMD npm start -- --host 0.0.0.0 --poll 2000