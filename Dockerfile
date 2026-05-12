# Build: docker build -t rafiq-api .
# Run:   docker run -e SPRING_PROFILES_ACTIVE=prod -e DATABASE_URL=postgres://... -p 8080:8080 rafiq-api
FROM eclipse-temurin:17-jdk-jammy AS build
WORKDIR /app

COPY pom.xml .
COPY mvnw .
COPY .mvn .mvn

RUN chmod +x mvnw

COPY src src
RUN ./mvnw --no-transfer-progress -DskipTests package

FROM eclipse-temurin:17-jre-jammy AS runtime
WORKDIR /app

RUN useradd --system --uid 1001 --no-create-home appuser

COPY --from=build /app/target/*.jar /app/app.jar

USER appuser
ENV SPRING_PROFILES_ACTIVE=prod

EXPOSE 8080

ENTRYPOINT ["java", "-XX:+UseContainerSupport", "-Djava.security.egd=file:/dev/./urandom", "-jar", "/app/app.jar"]
