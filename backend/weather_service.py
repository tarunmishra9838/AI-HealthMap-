import json
from datetime import datetime, timezone
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

# Preconfigured Indian surveillance hubs & major cities
SURVEILLANCE_CITIES: dict[str, dict] = {
    "lucknow": {
        "city": "Lucknow",
        "state": "Uttar Pradesh",
        "latitude": 26.8467,
        "longitude": 80.9462,
    },
    "kanpur": {
        "city": "Kanpur",
        "state": "Uttar Pradesh",
        "latitude": 26.4499,
        "longitude": 80.3319,
    },
    "varanasi": {
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "latitude": 25.3176,
        "longitude": 82.9739,
    },
    "prayagraj": {
        "city": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.4358,
        "longitude": 81.8463,
    },
    "gorakhpur": {
        "city": "Gorakhpur",
        "state": "Uttar Pradesh",
        "latitude": 26.7606,
        "longitude": 83.3732,
    },
    "agra": {
        "city": "Agra",
        "state": "Uttar Pradesh",
        "latitude": 27.1767,
        "longitude": 78.0081,
    },
    "meerut": {
        "city": "Meerut",
        "state": "Uttar Pradesh",
        "latitude": 28.9845,
        "longitude": 77.7064,
    },
    "ayodhya": {
        "city": "Ayodhya",
        "state": "Uttar Pradesh",
        "latitude": 26.7922,
        "longitude": 82.1998,
    },
    "noida": {
        "city": "Noida",
        "state": "Uttar Pradesh",
        "latitude": 28.5355,
        "longitude": 77.3910,
    },
    "ghaziabad": {
        "city": "Ghaziabad",
        "state": "Uttar Pradesh",
        "latitude": 28.6692,
        "longitude": 77.4538,
    },
    "delhi": {
        "city": "New Delhi",
        "state": "Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090,
    },
    "patna": {
        "city": "Patna",
        "state": "Bihar",
        "latitude": 25.5941,
        "longitude": 85.1376,
    },
    "mumbai": {
        "city": "Mumbai",
        "state": "Maharashtra",
        "latitude": 19.0760,
        "longitude": 72.8777,
    },
    "bengaluru": {
        "city": "Bengaluru",
        "state": "Karnataka",
        "latitude": 12.9716,
        "longitude": 77.5946,
    },
    "kolkata": {
        "city": "Kolkata",
        "state": "West Bengal",
        "latitude": 22.5726,
        "longitude": 88.3639,
    },
    "chennai": {
        "city": "Chennai",
        "state": "Tamil Nadu",
        "latitude": 13.0827,
        "longitude": 80.2707,
    },
    "hyderabad": {
        "city": "Hyderabad",
        "state": "Telangana",
        "latitude": 17.3850,
        "longitude": 78.4867,
    },
    "jaipur": {
        "city": "Jaipur",
        "state": "Rajasthan",
        "latitude": 26.9124,
        "longitude": 75.7873,
    },
    "bhopal": {
        "city": "Bhopal",
        "state": "Madhya Pradesh",
        "latitude": 23.2599,
        "longitude": 77.4126,
    },
}

WMO_WEATHER_MAP: dict[int, tuple[str, str]] = {
    0: ("Clear Sky", "Sunny"),
    1: ("Mainly Clear", "Mostly Sunny"),
    2: ("Partly Cloudy", "Partly Cloudy"),
    3: ("Overcast", "Cloudy"),
    45: ("Foggy", "Fog"),
    48: ("Depositing Rime Fog", "Fog"),
    51: ("Light Drizzle", "Drizzle"),
    53: ("Moderate Drizzle", "Rain"),
    55: ("Dense Drizzle", "Heavy Rain"),
    61: ("Slight Rain", "Light Rain"),
    63: ("Moderate Rain", "Rain"),
    65: ("Heavy Rain", "Heavy Rain"),
    71: ("Slight Snow", "Snow"),
    80: ("Rain Showers", "Showers"),
    81: ("Moderate Showers", "Showers"),
    82: ("Violent Showers", "Storm"),
    95: ("Thunderstorm", "Thunderstorm"),
    96: ("Thunderstorm with Hail", "Severe Storm"),
}


def get_city_list() -> list[dict]:
    """Returns the list of supported surveillance cities."""
    return list(SURVEILLANCE_CITIES.values())


def resolve_city_coordinates(city_query: str) -> Optional[dict]:
    """Matches a query string to a configured city."""
    normalized = city_query.strip().lower()
    if normalized in SURVEILLANCE_CITIES:
        return SURVEILLANCE_CITIES[normalized]

    # Partial prefix search
    for key, city_data in SURVEILLANCE_CITIES.items():
        if normalized in key or key in normalized:
            return city_data
    return None


def compute_environmental_outbreak_risk(
    temp_c: float,
    humidity_pct: float,
    precip_mm: float,
) -> dict:
    """
    Computes environmental disease outbreak risk indices exclusively for Dengue.
    - Dengue: Aedes mosquito breeding peak range: 24°C-34°C, humidity > 60%, standing water.
    - Aedes Breeding Index: Larval habitat favorability based on moisture and warmth.
    - Viral Incubation Velocity: Extrinsic incubation period (EIP) acceleration.
    """
    # 1. Dengue Vector Transmission Suitability
    dengue_score = 15
    if 24.0 <= temp_c <= 34.0:
        dengue_score += 45
    elif 20.0 <= temp_c < 24.0 or 34.0 < temp_c <= 38.0:
        dengue_score += 25

    if humidity_pct >= 65.0:
        dengue_score += 30
    elif humidity_pct >= 50.0:
        dengue_score += 18

    if precip_mm > 0.4:
        dengue_score += 10
    dengue_score = min(dengue_score, 100)

    if dengue_score >= 70:
        dengue_level = "High"
        dengue_msg = f"Temperature ({temp_c}°C) and humidity ({humidity_pct}%) are optimal for Aedes aegypti vector transmission."
    elif dengue_score >= 45:
        dengue_level = "Medium"
        dengue_msg = f"Moderate Dengue vector breeding conditions ({temp_c}°C, {humidity_pct}% RH). Check domestic water storage."
    else:
        dengue_level = "Low"
        dengue_msg = f"Current climatic conditions ({temp_c}°C) are suboptimal for Aedes vector proliferation."

    # 2. Aedes Mosquito Larval Breeding Suitability
    breeding_score = 15
    if 24.0 <= temp_c <= 33.0:
        breeding_score += 42
    elif 20.0 <= temp_c < 24.0:
        breeding_score += 20

    if humidity_pct >= 60.0:
        breeding_score += 32
    elif humidity_pct >= 45.0:
        breeding_score += 16

    if precip_mm > 0.4:
        breeding_score += 15
    breeding_score = min(breeding_score, 100)

    if breeding_score >= 70:
        breeding_level = "High"
        breeding_msg = f"High humidity ({humidity_pct}%) and standing water moisture support rapid Aedes larval incubation."
    elif breeding_score >= 45:
        breeding_level = "Medium"
        breeding_msg = "Moderate background humidity for container-breeding mosquitoes."
    else:
        breeding_level = "Low"
        breeding_msg = "Low environmental suitability for mosquito larval development."

    # 3. Viral Extrinsic Incubation Period (EIP) Acceleration
    eip_score = 20
    if temp_c >= 30.0:
        eip_score += 55
    elif temp_c >= 26.0:
        eip_score += 35
    elif temp_c >= 22.0:
        eip_score += 15

    if humidity_pct >= 50.0:
        eip_score += 25
    eip_score = min(eip_score, 100)

    if eip_score >= 65:
        eip_level = "High"
        eip_msg = f"Ambient warmth ({temp_c}°C) significantly shortens DENV extrinsic incubation period inside the mosquito."
    elif eip_score >= 40:
        eip_level = "Medium"
        eip_msg = f"Normal viral replication dynamics at {temp_c}°C."
    else:
        eip_level = "Low"
        eip_msg = f"Cooler temperature ({temp_c}°C) retards viral amplification within vector salivary glands."

    max_score = max(dengue_score, breeding_score, eip_score)
    if max_score >= 75:
        overall_level = "Critical"
    elif max_score >= 60:
        overall_level = "High"
    elif max_score >= 40:
        overall_level = "Medium"
    else:
        overall_level = "Low"

    return {
        "overall_level": overall_level,
        "max_risk_score": max_score,
        "dengue": {
            "disease": "Dengue (Aedes aegypti)",
            "score": dengue_score,
            "level": dengue_level,
            "interpretation": dengue_msg,
        },
        "aedes_breeding": {
            "disease": "Aedes Breeding Index",
            "score": breeding_score,
            "level": breeding_level,
            "interpretation": breeding_msg,
        },
        "viral_incubation": {
            "disease": "Viral Incubation Velocity",
            "score": eip_score,
            "level": eip_level,
            "interpretation": eip_msg,
        },
    }


def get_weather(
    latitude: float,
    longitude: float,
    city_name: Optional[str] = None,
) -> dict:
    """Fetch real-time weather and 7-day forecast data from Open-Meteo."""
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "precipitation,"
            "rain,"
            "showers,"
            "weather_code,"
            "wind_speed_10m"
        ),
        "daily": (
            "temperature_2m_max,"
            "temperature_2m_min,"
            "precipitation_sum,"
            "weather_code"
        ),
        "forecast_days": 7,
        "timezone": "auto",
    }

    url = "https://api.open-meteo.com/v1/forecast?" + urlencode(params)
    request = Request(url, headers={"User-Agent": "AI-HealthMap/1.0"})

    try:
        with urlopen(request, timeout=15) as response:
            data = json.loads(response.read().decode("utf-8"))

        current = data.get("current", {})
        if not current:
            raise ValueError("Weather data is currently unavailable.")

        temp_c = float(current.get("temperature_2m", 25.0) or 25.0)
        humidity = float(current.get("relative_humidity_2m", 50.0) or 50.0)
        precip = float(current.get("precipitation", 0.0) or 0.0)
        weather_code = int(current.get("weather_code", 0) or 0)

        condition_desc, condition_short = WMO_WEATHER_MAP.get(
            weather_code, ("Fair", "Fair")
        )

        # Environmental Outbreak Risk Analysis
        environmental_risk = compute_environmental_outbreak_risk(
            temp_c, humidity, precip
        )

        daily = data.get("daily", {})
        daily_times = daily.get("time", [])
        daily_max = daily.get("temperature_2m_max", [])
        daily_min = daily.get("temperature_2m_min", [])
        daily_precip = daily.get("precipitation_sum", [])
        daily_codes = daily.get("weather_code", [])

        forecast_list = []
        for i in range(len(daily_times)):
            c_code = daily_codes[i] if i < len(daily_codes) else 0
            desc, short_desc = WMO_WEATHER_MAP.get(c_code, ("Fair", "Fair"))
            forecast_list.append({
                "date": daily_times[i],
                "temp_max": daily_max[i] if i < len(daily_max) else None,
                "temp_min": daily_min[i] if i < len(daily_min) else None,
                "precipitation_mm": daily_precip[i] if i < len(daily_precip) else 0.0,
                "condition": desc,
                "short_condition": short_desc,
            })

        return {
            "source": "Open-Meteo",
            "data_status": "LIVE_WEATHER",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "location": {
                "city": city_name or "Custom Coordinates",
                "latitude": data.get("latitude", latitude),
                "longitude": data.get("longitude", longitude),
                "timezone": data.get("timezone", "Asia/Kolkata"),
            },
            "current": {
                "time": current.get("time"),
                "temperature_c": temp_c,
                "humidity_percent": humidity,
                "precipitation_mm": precip,
                "rain_mm": current.get("rain", 0.0),
                "showers_mm": current.get("showers", 0.0),
                "wind_speed_kmh": current.get("wind_speed_10m", 0.0),
                "weather_code": weather_code,
                "condition": condition_desc,
                "short_condition": condition_short,
            },
            "forecast_7_days": forecast_list,
            "raw_daily": daily,
            "environmental_risk": environmental_risk,
            "health_interpretation": {
                "dengue": environmental_risk["dengue"]["interpretation"],
                "aedes_breeding": environmental_risk["aedes_breeding"]["interpretation"],
                "viral_incubation": environmental_risk["viral_incubation"]["interpretation"],
            },
        }

    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError(f"Weather provider unavailable: {exc}") from exc
