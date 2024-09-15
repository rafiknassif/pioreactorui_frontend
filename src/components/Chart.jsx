import React, { useState, useEffect, useRef } from "react";
import {
  VictoryChart,
  VictoryLabel,
  VictoryAxis,
  VictoryTheme,
  VictoryLine,
  VictoryScatter,
  VictoryGroup,
  VictoryLegend,
  VictoryTooltip,
  createContainer,
} from "victory";
import moment from "moment";

const sensorRe = /(.*)-[12]/;

function toArray(thing) {
  return Array.isArray(thing) ? thing : [thing];
}

function Chart(props) {
  const [seriesMap, setSeriesMap] = useState({});
  const [hiddenSeries, setHiddenSeries] = useState(new Set());
  const [names, setNames] = useState([]);
  const [legendEvents, setLegendEvents] = useState([]);
  const [fetched, setFetched] = useState(false);

  const topics = toArray(props.topic);
  const yTransformation = props.yTransformation || ((y) => y);
  const VictoryVoronoiContainer =
    props.allowZoom || false
      ? createContainer("zoom", "voronoi")
      : createContainer("voronoi");

  const prevExperiment = useRef();
  const prevTopic = useRef();

  const xTransformation = (x) => x;

  const breakString = (n) => (string) => {
    if (string.length > n) {
      return (
        string.slice(0, n - 5) + "..." + string.slice(string.length - 2, string.length)
      );
    }
    return string;
  };

  const relabelAndFormatSeries = (name) => {
    if (!props.relabelMap) {
      return name;
    }

    const regexResults = name.match(/(.*)-([12])/);
    if (regexResults) {
      const [_, mainPart, sensor] = regexResults;
      return `${breakString(12)(props.relabelMap[mainPart] || mainPart)}-ch${sensor}`;
    } else {
      return breakString(12)(props.relabelMap[name] || name);
    }
  };

  const relabelAndFormatSeriesForLegend = (name) => {
    if (!props.relabelMap) {
      return name;
    }

    const nElements = Object.keys(props.relabelMap).length;
    let truncateString = breakString(Math.floor(100 / nElements));

    const regexResults = name.match(/(.*)-([12])/);
    if (regexResults) {
      const [_, mainPart, sensor] = regexResults;
      return `${truncateString(props.relabelMap[mainPart] || mainPart)}-ch${sensor}`;
    } else {
      return truncateString(props.relabelMap[name] || name);
    }
  };

  const createLegendEvents = () => {
    return [
      {
        childName: "legend",
        target: "data",
        eventHandlers: {
          onClick: (_, props) => {
            return [
              {
                childName: props.datum.name,
                target: "data",
                eventKey: "all",
                mutation: () => {
                  setHiddenSeries((prevHiddenSeries) => {
                    const newHiddenSeries = new Set(prevHiddenSeries);
                    if (!newHiddenSeries.has(props.datum.name)) {
                      newHiddenSeries.add(props.datum.name);
                    } else {
                      newHiddenSeries.delete(props.datum.name);
                    }
                    return newHiddenSeries;
                  });
                  return null;
                },
              },
            ];
          },
        },
      },
    ];
  };

  const getUnitColor = (name) => {
    if (sensorRe.test(name)) {
      let primaryName = name.match(sensorRe)[1];
      return getUnitColor(primaryName);
    } else {
      if (props.unitsColorMap) {
        return props.unitsColorMap[name];
      } else {
        return;
      }
    }
  };

  const getHistoricalDataFromServer = async () => {
    if (!props.experiment) {
      return;
    }
    const tweak = 0.65; // increase to filter more
    const queryParams = new URLSearchParams({
      filter_mod_N: props.downSample
        ? Math.max(Math.floor(tweak * Math.min(props.deltaHours, props.lookback)), 1)
        : 1,
      lookback: props.lookback,
    });

    let transformX;
    if (props.byDuration) {
      const experimentStartTime = moment.utc(props.experimentStartTime);
      transformX = (x) =>
        Math.round(
          moment
            .utc(x, "YYYY-MM-DDTHH:mm:ss.SSSSS")
            .diff(experimentStartTime, "hours", true) * 1e3
        ) / 1e3;
    } else {
      transformX = (x) => moment.utc(x, "YYYY-MM-DDTHH:mm:ss.SSSSS").local();
    }

    try {
      const response = await fetch(
        `/api/experiments/${props.experiment}/time_series/${props.dataSource}${
          props.dataSourceColumn ? "/" + props.dataSourceColumn : ""
        }?${queryParams}`
      );
      const data = await response.json();
      let initialSeriesMap = {};
      for (const [i, unit] of data["series"].entries()) {
        if (props.unit) {
          if (
            props.isPartitionedBySensor &&
            unit !== props.unit + "-2" &&
            unit !== props.unit + "-1"
          ) {
            continue;
          } else if (!props.isPartitionedBySensor && unit !== props.unit) {
            continue;
          }
        }

        if (data["data"][i].length > 0) {
          initialSeriesMap[unit] = {
            data: data["data"][i].map((item) => ({
              y: item.y,
              x: transformX(item.x),
            })),
            name: unit,
            color: getUnitColor(unit),
          };
        }
      }
      let newNames = Object.keys(initialSeriesMap);
      const events = createLegendEvents();
      setSeriesMap(initialSeriesMap);
      setLegendEvents(events);
      setNames(newNames);
      setFetched(true);
    } catch (e) {
      console.log(e);
      setFetched(true);
    }
  };

  const onMessage = (topic, message, packet) => {
    if (!fetched) {
      return;
    }
    if (packet.retain) {
      return;
    }

    if (!message.toString()) {
      return;
    }

    let y_value, timestamp;
    try {
      if (props.payloadKey) {
        var payload = JSON.parse(message.toString());
        if (!payload.hasOwnProperty(props.payloadKey)) {
          throw new Error(`Payload key '${props.payloadKey}' not found in the message.`);
        }
        timestamp = moment.utc(payload.timestamp);
        y_value = parseFloat(payload[props.payloadKey]);
      } else {
        y_value = parseFloat(message.toString());
        timestamp = moment.utc();
      }
    } catch (error) {
      return;
    }
    var duration =
      Math.round(
        timestamp.diff(moment.utc(props.experimentStartTime), "hours", true) * 1e3
      ) / 1e3;
    var local_timestamp = timestamp.local();
    const x_value = props.byDuration ? duration : local_timestamp;

    var unit = props.isPartitionedBySensor
      ? topic.split("/")[1] + "-" + topic.split("/")[4].replace("od", "")
      : topic.split("/")[1];

    if (props.unit) {
      if (
        props.isPartitionedBySensor &&
        unit !== props.unit + "-2" &&
        unit !== props.unit + "-1"
      ) {
        return;
      } else if (!props.isPartitionedBySensor && unit !== props.unit) {
        return;
      }
    }

    try {
      if (!seriesMap[unit]) {
        const newSeriesMap = {
          ...seriesMap,
          [unit]: {
            data: [{ x: x_value, y: y_value }],
            name: unit,
            color: getUnitColor(unit),
          },
        };
        setSeriesMap(newSeriesMap);
        setNames((prevNames) => [...prevNames, unit]);
      } else {
        const updatedData = seriesMap[unit].data.concat({ x: x_value, y: y_value });
        setSeriesMap((prevSeriesMap) => ({
          ...prevSeriesMap,
          [unit]: {
            ...prevSeriesMap[unit],
            data: updatedData,
          },
        }));
      }
    } catch (error) {
      console.log(error);
    }
  };

  const createToolTip = (d) => {
    let x_value;
    try {
      if (props.byDuration) {
        x_value = `${d.datum.x.toFixed(2)} hours elapsed`;
      } else {
        x_value = d.datum.x.format("MMM DD HH:mm");
      }
    } catch {
      x_value = d.datum.x;
    }

    return `${x_value}
${relabelAndFormatSeries(d.datum.childName)}: ${
      Math.round(yTransformation(d.datum.y) * 10 ** props.fixedDecimals) /
      10 ** props.fixedDecimals
    }`;
  };

  const selectLegendData = (name) => {
    var reformattedName = relabelAndFormatSeriesForLegend(name);
    if (Object.keys(seriesMap).length === 0) {
      return {};
    }
    const line = seriesMap?.[name];
    const item = {
      name: reformattedName,
      symbol: { fill: line.color },
    };
    if (hiddenSeries.has(reformattedName)) {
      return { ...item, symbol: { fill: "white" } };
    }
    return item;
  };

  const selectVictoryLines = (name) => {
    var reformattedName = relabelAndFormatSeries(name);

    var marker = null;
    if (seriesMap[name]?.data?.length === 1) {
      marker = (
        <VictoryScatter
          size={4}
          key={"line-" + reformattedName + props.chartKey}
          name={reformattedName}
          style={{
            data: {
              fill: seriesMap[name]?.color,
            },
          }}
        />
      );
    } else {
      marker = (
        <VictoryLine
          interpolation={props.interpolation}
          key={"line-" + reformattedName + props.chartKey}
          name={reformattedName}
          style={{
            labels: { fill: seriesMap?.[name]?.color },
            data: {
              stroke: seriesMap?.[name]?.color,
              strokeWidth: 2,
            },
            parent: { border: "1px solid #ccc" },
          }}
        />
      );
    }

    return (
      <VictoryGroup
        key={props.chartKey}
        data={hiddenSeries.has(reformattedName) ? [] : seriesMap?.[name]?.data}
        x={(datum) => xTransformation(datum.x)}
        y={(datum) => yTransformation(datum.y)}
      >
        {marker}
      </VictoryGroup>
    );
  };

  useEffect(() => {
    getHistoricalDataFromServer();
    if (props.client && props.isLiveChart) {
      topics.forEach((topic) => {
        props.subscribeToTopic(
          `pioreactor/+/${props.experiment}/${topic}`,
          onMessage,
          "Chart"
        );
      });
    }

    return () => {
      if (props.client && props.isLiveChart) {
        topics.forEach((topic) => {
          props.unsubscribeFromTopic(
            `pioreactor/+/${props.experiment}/${topic}`,
            "Chart"
          );
        });
      }
    };
  }, []);

  useEffect(() => {
    if (prevExperiment.current !== props.experiment) {
      getHistoricalDataFromServer();
      if (props.isLiveChart && props.client) {
        if (prevExperiment.current && prevTopic.current) {
          toArray(prevTopic.current).forEach((topic) => {
            props.unsubscribeFromTopic(
              `pioreactor/+/${prevExperiment.current}/${topic}`,
              "Chart"
            );
          });
        }
        topics.forEach((topic) => {
          props.subscribeToTopic(
            `pioreactor/+/${props.experiment}/${topic}`,
            onMessage,
            "Chart"
          );
        });
      }
      prevExperiment.current = props.experiment;
      prevTopic.current = props.topic;
    }

    return () => {
      if (props.isLiveChart && props.client) {
        topics.forEach((topic) => {
          props.unsubscribeFromTopic(
            `pioreactor/+/${props.experiment}/${topic}`,
            "Chart"
          );
        });
      }
    };
  }, [props.experiment]);

  useEffect(() => {
    getHistoricalDataFromServer();
  }, [props.byDuration, props.lookback]);

  return (
    <VictoryChart
      style={{ parent: { maxWidth: "700px" } }}
      title={props.title}
      domainPadding={10}
      padding={{
        left: 70,
        right: 50,
        bottom: 60 + 20 * Math.floor(names.length / 4),
        top: 50,
      }}
      events={legendEvents}
      height={295 + 20 * Math.floor(names.length / 4)}
      width={600}
      scale={{ x: props.byDuration ? "linear" : "time" }}
      theme={VictoryTheme.material}
      containerComponent={
        <VictoryVoronoiContainer
          zoomDimension={"x"}
          responsive={true}
          voronoiBlacklist={["parent"]}
          labels={createToolTip}
          labelComponent={
            <VictoryTooltip
              cornerRadius={0}
              flyoutStyle={{
                fill: "white",
                stroke: "#90a4ae",
                strokeWidth: 1.5,
              }}
            />
          }
        />
      }
    >
      <VictoryLabel
        text={props.title}
        x={300}
        y={30}
        textAnchor="middle"
        style={{
          fontSize: 16,
          fontFamily: "inherit",
        }}
      />
      <VictoryAxis
        style={{
          tickLabels: {
            fontSize: 14,
            padding: 5,
            fontFamily: "inherit",
          },
        }}
        offsetY={60 + 20 * Math.floor(names.length / 4)}
        label={props.byDuration ? "Hours" : "Time"}
        orientation="bottom"
        fixLabelOverlap={true}
        axisLabelComponent={
          <VictoryLabel
            dy={-15}
            dx={262}
            style={{
              fontSize: 12,
              fontFamily: "inherit",
              fill: "grey",
            }}
          />
        }
      />
      <VictoryAxis
        crossAxis={false}
        dependentAxis
        domain={props.allowZoom ? null : props.yAxisDomain}
        tickFormat={(t) => `${t.toFixed(props.fixedDecimals)}`}
        label={props.yAxisLabel}
        axisLabelComponent={
          <VictoryLabel
            dy={-41}
            style={{
              fontSize: 15,
              padding: 10,
              fontFamily: "inherit",
            }}
          />
        }
        style={{
          tickLabels: {
            fontSize: 14,
            padding: 5,
            fontFamily: "inherit",
          },
        }}
      />
      <VictoryLegend
        x={65}
        y={270}
        symbolSpacer={6}
        itemsPerRow={4}
        name="legend"
        borderPadding={{ right: 8 }}
        orientation="horizontal"
        cursor="pointer"
        gutter={15}
        rowGutter={5}
        style={{
          labels: { fontSize: 13 },
          data: { stroke: "#485157", strokeWidth: 0.5, size: 6.5 },
        }}
        data={names.map(selectLegendData)}
      />
      {Object.keys(seriesMap).map(selectVictoryLines)}
    </VictoryChart>
  );
}

export default Chart;
