FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src src
RUN mvn -B -DskipTests package
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r arena && useradd -r -g arena arena
COPY --from=build /app/target/agentarena-api-0.1.0.jar app.jar
USER arena
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
