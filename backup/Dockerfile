FROM postgres:16-alpine

WORKDIR /backup

COPY backup.sh .
RUN chmod +x backup.sh

CMD ["./backup.sh"]
