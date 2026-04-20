FROM golang:1.25-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /bin/login ./cmd/login \
 && CGO_ENABLED=0 GOOS=linux go build -o /bin/platform ./cmd/platform \
 && CGO_ENABLED=0 GOOS=linux go build -o /bin/core ./cmd/core \
 && CGO_ENABLED=0 GOOS=linux go build -o /bin/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -o /bin/frontend ./cmd/frontend

FROM alpine:3.19
RUN apk add --no-cache ca-certificates

ARG SERVICE=platform

COPY --from=builder /bin/login /bin/login
COPY --from=builder /bin/platform /bin/platform
COPY --from=builder /bin/core /bin/core
COPY --from=builder /bin/api /bin/api
COPY --from=builder /bin/frontend /bin/frontend

ENV SERVICE=${SERVICE}
EXPOSE 8080

ENTRYPOINT ["/bin/sh", "-c", "exec /bin/${SERVICE}"]