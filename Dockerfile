FROM node:10.15 as builder

WORKDIR /opt/app

COPY package.json yarn.lock /opt/app/

RUN yarn install

COPY src /opt/app/src

RUN yarn build

#FROM node:10.15
FROM ubuntu:18.04

ENV NODE_ENV production
WORKDIR /opt/app

COPY package.json yarn.lock /opt/app/

RUN apt-get update && \
    apt-get install -y software-properties-common curl && \
    add-apt-repository -y ppa:stebbins/handbrake-releases && \
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add - && \
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list && \
    curl -sL https://deb.nodesource.com/setup_10.x | bash - && \
    apt-get install -y nodejs yarn handbrake-cli

RUN yarn install

COPY --from=builder /opt/app/build /opt/app/build
COPY encode.sh /opt/app/
COPY handbrake-preset-H264.json /opt/app/
RUN mkdir /opt/app/.downloads

# This is sad
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

VOLUME /opt/app/.downloads

CMD ["node", "build/server.js"]
