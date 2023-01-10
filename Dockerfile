FROM etherpad/etherpad:1.8.18
ARG API_KEY
RUN echo ${API_KEY} >> /opt/etherpad-lite/APIKEY.txt