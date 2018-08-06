/**
 * Inserts a red square at (0, 0) in the current artboard or edit context.
 */

const { Text } = require("scenegraph");

function query(yql) {
    const encodedYql = encodeURIComponent(yql);
    const url = `https://query.yahooapis.com/v1/public/yql?q=${encodedYql}&format=json&env=store%3A%2F%2Fdatatables.org%2Falltableswithkeys`;

    return new Promise((resolve, reject) => {
        const req = new XMLHttpRequest();
        req.onload = () => {
            if (req.status === 200) {
                try {
                    resolve(JSON.parse(req.response));
                } catch (err) {
                    reject(`Couldn't parse response. ${err.message}, ${req.response}`);
                }
            } else {
                reject(`Request had an error: ${req.status}`);
            }
        }
        req.onerror = reject;
        req.onabort = reject;
        req.open('GET', url);
        req.send();
    });
}

async function yqlWeatherAdapter(place, unit = "f") {
    const yql = `select * from weather.forecast where woeid in (select woeid from geo.places(1) where text="${place}") and u="${unit}"`;
    const weatherData = {
        place,
        unit,
        ok: false
    };

    try {
        const data = await query(yql);
        if (data.query.count > 0) {
            return Object.assign({}, weatherData, {
                ok: true,
                current: {
                    wind: {
                        speed: data.query.results.channel.wind.speed,
                        direction: data.query.results.channel.wind.direction
                    },
                    humidity: data.query.results.channel.atmosphere.humidity,
                    pressure: data.query.results.channel.atmosphere.pressure,
                    temperature: data.query.results.channel.item.condition.temp,
                    feelsLike: data.query.results.channel.wind.chill,
                    description: data.query.results.channel.item.condition.text,
                    when: data.query.results.channel.item.condition.date
                },
                forecast: data.query.results.channel.item.forecast.map(forecast => ({
                    when: forecast.date,
                    dayOfWeek: forecast.day,
                    high: forecast.high,
                    low: forecast.low,
                    description: forecast.text
                }))
            });
        } else {
            return Object.assign({}, weatherData, {
                msg: "No data found for the location"
            });
        }
    } catch (err) {
        return Object.assign({}, weatherData, {
            msg: err.message,
            error: err
        });
    }
}

async function fetchWeather(location) {
    return (await yqlWeatherAdapter(location)).current.temperature;
}

function getAllOperableElements(selection) {
    return selection.items
        .filter(item => item instanceof Text)
        .filter(text => text.name.startsWith('WX: '));
}

function getGuids(els) {
    return els.map(el => el.guid);
}

async function updateWeather(selection) {
    const els = getAllOperableElements(selection);
    const guids = getGuids(els);

    const locations = els.map(el => el.name.substr(4));
    const temps = await Promise.all(locations.map(location => fetchWeather(location)));

    // double check that we still have the same items selected
    const newEls = getAllOperableElements(selection);
    const newGuids = getGuids(newEls);
    if (guids.join(",") === newGuids.join(",")) {
        els.forEach((el, idx) => {
            const curTemp = temps[idx];
            el.text = `${curTemp}°`;
        });
    } else {
        console.log(`Couldn't update weather; selection changed.`);
    }
}

module.exports = {
    commands: {
        updateWeather
    }
};