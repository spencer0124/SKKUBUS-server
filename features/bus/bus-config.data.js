const { t } = require("../../lib/i18n");

/**
 * Bump this whenever config data changes so clients know to re-fetch.
 */
const CONFIG_VERSION = 1;

/**
 * Returns all bus route configurations keyed by route id.
 * Text fields are resolved to the requested language via i18n.
 *
 * @param {string} lang — "ko" | "en" | "zh"
 */
function getBusConfigs(lang = "ko") {
  return {
    hssc: {
      id: "hssc",
      screenType: "realtime",
      fallbackUrl: null,
      display: {
        name: t("buslist.hssc.title", lang),
        themeColor: "003626",
        iconType: "shuttle",
      },
      realtime: {
        stationsEndpoint: "/bus/hssc/stations",
        locationsEndpoint: "/bus/hssc/location",
        refreshInterval: 15,
      },
      features: {
        info: { url: "https://webview.skkuuniverse.com/#/bus/hssc/info" },
      },
    },
    jongro07: {
      id: "jongro07",
      screenType: "realtime",
      fallbackUrl: null,
      display: {
        name: t("buslist.jongro07.title", lang),
        themeColor: "4CAF50",
        iconType: "village",
      },
      realtime: {
        stationsEndpoint: "/bus/jongro/stations/07",
        locationsEndpoint: "/bus/jongro/location/07",
        refreshInterval: 15,
      },
      features: {
        routeOverlay: {
          coordsEndpoint: "/bus/route/jongro07",
          color: "4CAF50",
        },
      },
    },
    jongro02: {
      id: "jongro02",
      screenType: "realtime",
      fallbackUrl: null,
      display: {
        name: t("buslist.jongro02.title", lang),
        themeColor: "4CAF50",
        iconType: "village",
      },
      realtime: {
        stationsEndpoint: "/bus/jongro/stations/02",
        locationsEndpoint: "/bus/jongro/location/02",
        refreshInterval: 15,
      },
      features: {
        routeOverlay: {
          coordsEndpoint: "/bus/route/jongro02",
          color: "4CAF50",
        },
      },
    },
    campus: {
      id: "campus",
      screenType: "schedule",
      fallbackUrl: "https://webview.skkuuniverse.com/#/bus/campus/info",
      display: {
        name: t("buslist.inja.title", lang),
        themeColor: "003626",
        iconType: "shuttle",
      },
      schedule: {
        directions: [
          {
            id: "INJA",
            label: t("busconfig.direction.inja", lang),
            endpoint: "/bus/campus/INJA",
          },
          {
            id: "JAIN",
            label: t("busconfig.direction.jain", lang),
            endpoint: "/bus/campus/JAIN",
          },
        ],
        serviceCalendar: {
          defaultServiceDays: [0, 1, 2, 3, 4], // 0=Mon...6=Sun
          exceptions: [
            { date: "2026-03-01", reason: t("busconfig.holiday.samil", lang), service: false },
            { date: "2026-05-05", reason: t("busconfig.holiday.children", lang), service: false },
          ],
        },
        routeTypes: {
          hakbu: t("busconfig.routeType.hakbu", lang),
          regular: t("busconfig.routeType.regular", lang),
        },
      },
      features: {
        info: { url: "https://webview.skkuuniverse.com/#/bus/campus/info" },
        eta: { endpoint: "/bus/campus/eta" },
      },
    },
  };
}

module.exports = { getBusConfigs, CONFIG_VERSION };
