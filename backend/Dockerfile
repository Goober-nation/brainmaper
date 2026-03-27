# Stage 1: Build the binary
FROM golang:1.26-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod ./
COPY go.sum ./

RUN go mod download

# Copy source code
COPY . .

# Build the application
# CGO_ENABLED=0 makes the binary statically linked (more portable)
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Stage 2: Run the binary
FROM alpine:latest

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/main .

# Expose the API port
EXPOSE 8080

# Run the compiled binary
CMD ["./main"]
