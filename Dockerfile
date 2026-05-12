FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
USER app
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# Copy project files first to cache dependencies
COPY ["CubeDoku.Server/CubeDoku.Server.csproj", "CubeDoku.Server/"]
COPY ["CubeDoku.Client/CubeDoku.Client.esproj", "CubeDoku.Client/"]

# Restore dependencies
RUN dotnet restore "./CubeDoku.Server/CubeDoku.Server.csproj"

# Copy the rest of the source code
COPY . .
WORKDIR "/src/CubeDoku.Server"

# Build the project
RUN dotnet build "./CubeDoku.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

FROM build AS publish
ARG BUILD_CONFIGURATION=Release
RUN dotnet publish "./CubeDoku.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "CubeDoku.Server.dll"]
