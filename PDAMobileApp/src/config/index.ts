interface Config {
  API_URL: string;
  API_ENDPOINTS: {
    CHECK_CALENDAR: string;
    CHECK_WEATHER: string;
    SET_REMINDER: string;
    SEARCH_INFORMATION: string;
  };
}

const DEV_CONFIG: Config = {
  API_URL: 'http://192.168.1.8:5000/api',
  API_ENDPOINTS: {
    CHECK_CALENDAR: '/tools/check_calendar',
    CHECK_WEATHER: '/tools/check_weather',
    SET_REMINDER: '/tools/set_reminder',
    SEARCH_INFORMATION: '/tools/search_information',
  },
};

const PROD_CONFIG: Config = {
  API_URL: 'https://your-production-api.com/api', // Update with your production API URL
  API_ENDPOINTS: {
    CHECK_CALENDAR: '/tools/check_calendar',
    CHECK_WEATHER: '/tools/check_weather',
    SET_REMINDER: '/tools/set_reminder',
    SEARCH_INFORMATION: '/tools/search_information',
  },
};

export const config = __DEV__ ? DEV_CONFIG : PROD_CONFIG;