// Copyright (c) 2023 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/* eslint-disable max-statements */
import test from 'tape-catch';
import sinon from 'sinon';
import {console as Console} from 'global/window';

import {drainTasksForTesting, succeedTaskInTest, errorTaskInTest} from 'react-palm/tasks';
import CloneDeep from 'lodash.clonedeep';

import {VisStateActions, MapStateActions} from '@kepler.gl/actions';
import {
  visStateReducer as reducer,
  INITIAL_VIS_STATE,
  DEFAULT_ANIMATION_CONFIG,
  serializeLayer,
  validateLayerWithData,
  defaultInteractionConfig,
  prepareStateForDatasetReplace
} from '@kepler.gl/reducers';

import {processCsvData, processGeojson} from '@kepler.gl/processors';
import {Layer, KeplerGlLayers} from '@kepler.gl/layers';
import {KeplerTable, createNewDataEntry, maybeToDate} from '@kepler.gl/table';
import {createDataContainer, getDefaultFilter} from '@kepler.gl/utils';
import {
  ALL_FIELD_TYPES,
  EDITOR_MODES,
  LAYER_VIS_CONFIGS,
  DEFAULT_TEXT_LABEL,
  DEFAULT_COLOR_UI,
  FILTER_VIEW_TYPES
} from '@kepler.gl/constants';

const {ArcLayer, PointLayer, GeojsonLayer, LineLayer, TripLayer} = KeplerGlLayers;

// fixtures
import testData, {
  mergedTimeFilter,
  testFields,
  testAllData,
  testCsvFieldPairs
} from 'test/fixtures/test-csv-data';
import {
  geojsonData,
  geoJsonTripFilterProps,
  expectedDataToFeature,
  updatedGeoJsonLayer,
  fields as geojsonFields,
  rows as geojsonRows
} from 'test/fixtures/geojson';

import tripGeojson, {timeStampDomain, tripDataInfo} from 'test/fixtures/trip-geojson';
import {mockPolygonFeature, mockPolygonFeature2, mockPolygonData} from 'test/fixtures/polygon';

// test helpers
import {
  cmpFilters,
  cmpLayers,
  cmpEffects,
  cmpDatasets,
  cmpDataset,
  cmpObjectKeys,
  cmpField,
  assertDatasetIsTable
} from 'test/helpers/comparison-utils';
import {
  applyActions,
  StateWTripGeojson,
  StateWSplitMaps,
  StateWFilters,
  StateWFiles,
  StateWFilesFiltersLayerColor,
  StateWH3Layer,
  testCsvDataId,
  testGeoJsonDataId,
  InitialState
} from 'test/helpers/mock-state';
import {getNextColorMakerValue} from 'test/helpers/layer-utils';

const mockData = {
  fields: [
    {
      name: 'start_point_lat',
      type: 'real'
    },
    {
      name: 'start_point_lng',
      type: 'real'
    },
    {
      name: 'end_point_lat',
      type: 'real'
    },
    {
      name: 'end_point_lng',
      type: 'real'
    }
  ],
  data: [
    [12.25, 37.75, 45.21, 100.12],
    [null, 35.2, 45.0, 21.3],
    [12.29, 37.64, 46.21, 99.127],
    [null, null, 33.1, 29.34]
  ]
};

const expectedFields = [
  {
    name: 'start_point_lat',
    displayName: 'start_point_lat',
    id: 'start_point_lat',
    type: 'real',
    fieldIdx: 0,
    analyzerType: 'FLOAT',
    format: '',
    valueAccessor: values => values[1]
  },
  {
    name: 'start_point_lng',
    displayName: 'start_point_lng',
    id: 'start_point_lng',
    type: 'real',
    fieldIdx: 1,
    analyzerType: 'FLOAT',
    format: '',
    valueAccessor: values => values[1]
  },
  {
    name: 'end_point_lat',
    displayName: 'end_point_lat',
    id: 'end_point_lat',
    type: 'real',
    fieldIdx: 2,
    analyzerType: 'FLOAT',
    format: '',
    valueAccessor: values => values[2]
  },
  {
    name: 'end_point_lng',
    displayName: 'end_point_lng',
    id: 'end_point_lng',
    type: 'real',
    fieldIdx: 3,
    analyzerType: 'FLOAT',
    format: '',
    valueAccessor: values => values[3]
  }
];

const expectedFieldParis = [
  {
    defaultName: 'start_point',
    pair: {
      lat: {
        value: 'start_point_lat',
        fieldIdx: 0
      },
      lng: {
        value: 'start_point_lng',
        fieldIdx: 1
      }
    },
    suffix: ['lat', 'lng']
  },
  {
    defaultName: 'end_point',
    pair: {
      lat: {
        value: 'end_point_lat',
        fieldIdx: 2
      },
      lng: {
        value: 'end_point_lng',
        fieldIdx: 3
      }
    },
    suffix: ['lat', 'lng']
  }
];

const mockFilter = {
  fieldIdx: 0,
  name: mockData.fields[0].name,
  displayName: mockData.fields[0].name,
  id: mockData.fields[0].name,
  type: 'range',
  fieldType: 'real',
  value: [12.25, 12.28]
};

const mockRawData = {
  fields: [
    {
      name: 'start_point_lat',
      id: 'start_point_lat',
      displayName: 'start_point_lat',
      type: 'real',
      fieldIdx: 0
    },
    {
      name: 'start_point_lng',
      id: 'start_point_lng',
      displayName: 'start_point_lng',
      type: 'real',
      fieldIdx: 1
    },
    {
      name: 'end_point_lat',
      id: 'end_point_lat',
      displayName: 'end_point_lat',
      type: 'real',
      fieldIdx: 2
    },
    {
      name: 'end_point_lng',
      id: 'end_point_lng',
      displayName: 'end_point_lng',
      type: 'real',
      fieldIdx: 3
    }
  ],
  rows: [
    [12.25, 37.75, 45.21, 100.12],
    [null, 35.2, 45.0, 21.3],
    [12.29, 37.64, 46.21, 99.127],
    [null, null, 33.1, 29.34]
  ]
};

test('#visStateReducer', t => {
  t.deepEqual(
    reducer(undefined, {}),
    {...INITIAL_VIS_STATE, initialState: {}},
    'should return the initial state'
  );

  t.end();
});

test('#visStateReducer -> ADD_FILTER', t => {
  const dataId = 'kitten';
  const newFilter = getDefaultFilter({dataId});
  const newReducer = reducer({filters: [mockFilter]}, VisStateActions.addFilter(dataId));

  const expectedReducer = {filters: [mockFilter, newFilter]};

  t.equal(newReducer.filters.length, expectedReducer.filters.length, 'should add a default filter');

  t.deepEqual(newReducer.filters[0], expectedReducer.filters[0], 'should add a default filter');

  cmpFilters(t, newReducer.filters[1], expectedReducer.filters[1]);
  t.end();
});

test('#visStateReducer -> ADD_LAYER.1', t => {
  const oldState = {
    ...INITIAL_VIS_STATE,
    datasets: {
      puppy: {
        data: mockData.data,
        fields: mockData.fields
      }
    },
    layers: [{id: 'existing_layer'}],
    layerData: [[{data: [1, 2, 3]}, {data: [4, 5, 6]}]],
    layerOrder: ['existing_layer'],
    splitMaps: [
      {
        layers: {existing_layer: false}
      },
      {
        layers: {existing_layer: false}
      }
    ]
  };

  const newReducer = reducer(oldState, VisStateActions.addLayer());
  const newId = newReducer.layers[1].id;
  const expectedSplitMaps = [
    {
      layers: {
        existing_layer: false,
        [newId]: true
      }
    },
    {
      layers: {
        existing_layer: false,
        [newId]: true
      }
    }
  ];

  t.equal(newReducer.layers.length, 2, 'should have 2 layers');
  t.equal(newReducer.layers[1].config.isVisible, true, 'newLayer visibility should be set to true');
  t.equal(
    newReducer.layers[1].config.isConfigActive,
    true,
    'newLayer isConfigActive should be set to true'
  );
  t.equal(newReducer.layers[1].config.dataId, 'puppy', 'newLayer dataId should be set to default');
  t.deepEqual(
    newReducer.layerData,
    [oldState.layerData[0], {}],
    'newState should have empty layer datat'
  );
  t.deepEqual(
    newReducer.layerOrder,
    [newReducer.layers[1].id, newReducer.layers[0].id],
    'should add to layerOrder'
  );
  t.deepEqual(newReducer.splitMaps, expectedSplitMaps, 'should add to SplitMaps');

  t.end();
});

test('#visStateReducer -> LAYER_TYPE_CHANGE.0', t => {
  const layer = new Layer({id: 'blue'});

  const oldState = {
    ...INITIAL_VIS_STATE
  };

  const nextState = reducer(oldState, VisStateActions.layerTypeChange());

  t.equal(oldState, nextState, 'should return state when no argument is given');

  const nextState2 = reducer(oldState, VisStateActions.layerTypeChange(layer, 'no_type'));
  t.equal(oldState, nextState2, 'should return state when pass a none existing type');

  t.end();
});

test('#visStateReducer -> LAYER_TYPE_CHANGE.1', t => {
  const layer = new Layer({id: 'more_layer'});
  const oldState = {
    ...INITIAL_VIS_STATE,
    datasets: {
      puppy: {
        data: mockData.data,
        fields: mockData.fields
      }
    },
    layers: [{id: 'existing_layer'}, layer],
    layerData: [[{data: [1, 2, 3]}, {data: [4, 5, 6]}]],
    layerOrder: ['more_layer', 'existing_layer'],
    hoverInfo: {
      layer: {props: {id: 'more_layer'}},
      picked: true
    },
    clicked: {
      layer: {props: {id: 'more_layer'}},
      picked: true
    },
    splitMaps: [
      {
        layers: {
          existing_layer: false,
          more_layer: true
        }
      },
      {
        layers: {
          existing_layer: false,
          more_layer: false
        }
      }
    ]
  };

  const nextState = reducer(oldState, VisStateActions.layerTypeChange(layer, 'point'));
  const newId = nextState.layers[1].id;
  const expectedSplitMaps = [
    {
      layers: {
        existing_layer: false,
        [newId]: true
      }
    },
    {
      layers: {
        existing_layer: false,
        [newId]: false
      }
    }
  ];

  t.ok(nextState.layers[1].id !== 'more_layer', 'should update layer id');

  t.equal(nextState.layers[1].type, 'point', 'should update type to point');

  t.deepEqual(
    nextState.splitMaps,
    expectedSplitMaps,
    'should add newId to SplitMaps, and replace old id'
  );

  t.ok(!nextState.clicked, 'should reset clicked');
  t.ok(!nextState.hoverInfo, 'should reset hoverInfo');

  t.end();
});

test('#visStateReducer -> LAYER_TYPE_CHANGE.2', t => {
  const pointLayer = new PointLayer({id: 'a', dataId: 'smoothie'});
  const mockColorRange = {
    name: 'abc',
    isReversed: true,
    colors: ['a', 'b', 'c']
  };
  const datasets = createNewDataEntry({
    info: {id: 'smoothie'},
    data: {
      rows: testAllData,
      fields: testFields
    }
  });
  const oldState = {
    ...INITIAL_VIS_STATE,
    datasets,
    layers: [pointLayer],
    layerData: []
  };

  // set point layer colorField to a string field
  let stringField = testFields.find(f => f.type === 'string');
  stringField = {
    ...stringField,
    valueAccessor: stringField.valueAccessor(datasets.smoothie.dataContainer)
  };
  let nextState = reducer(
    oldState,
    VisStateActions.layerVisualChannelConfigChange(pointLayer, {colorField: stringField}, 'color')
  );
  nextState = reducer(
    nextState,
    VisStateActions.layerVisConfigChange(nextState.layers[0], {
      colorRange: mockColorRange
    })
  );
  const newLayer = nextState.layers[0];
  t.equal(newLayer.config.colorField, stringField, 'should update colorField');
  t.equal(newLayer.config.colorScale, 'ordinal', 'should scale to ordinal');
  t.deepEqual(
    newLayer.config.colorDomain,
    ['driver_analytics', 'driver_analytics_0', 'driver_gps'],
    'should calculate color domain'
  );
  t.equal(newLayer.config.visConfig.colorRange, mockColorRange, 'should update color range');

  // set point layer sizeField to a int field
  let intField = testFields.find(f => f.type === 'integer');
  intField = {...intField, valueAccessor: intField.valueAccessor(datasets.smoothie.dataContainer)};
  let nextState2 = reducer(
    nextState,
    VisStateActions.layerVisualChannelConfigChange(newLayer, {sizeField: intField}, 'size')
  );
  nextState2 = reducer(
    nextState2,
    VisStateActions.layerVisConfigChange(nextState2.layers[0], {
      radiusRange: [5, 10]
    })
  );
  const newLayer2 = nextState2.layers[0];
  t.equal(newLayer2.config.sizeField, intField, 'should update sizeField');
  t.equal(newLayer2.config.sizeScale, 'sqrt', 'should scale to sqrt');
  t.deepEqual(newLayer2.config.sizeDomain, [1, 12124], 'should calculate size domain');
  t.deepEqual(newLayer2.config.visConfig.radiusRange, [5, 10], 'should update size range');

  // change point layer type to hexagon
  const nextState3 = reducer(nextState2, VisStateActions.layerTypeChange(newLayer2, 'hexagon'));

  const newLayer3 = nextState3.layers[0];
  t.equal(newLayer3.type, 'hexagon', 'should change type to hexagon');
  t.equal(newLayer3.config.colorField, stringField, 'should keep colorField');
  t.deepEqual(
    newLayer3.config.colorDomain,
    [0, 1],
    'should set colorDomain to default, it is calculated inside deck.gl layer'
  );
  t.equal(newLayer3.config.colorScale, 'ordinal', 'should set colorScale to ordinal');
  t.equal(newLayer3.config.sizeScale, 'sqrt', 'should set sizeScale to default');
  t.deepEqual(newLayer3.config.sizeDomain, [0, 1], 'should set sizeDomain to default');
  t.equal(newLayer3.config.sizeField, intField, 'should keep sizeField');
  t.notEqual(newLayer3.id, newLayer2.id, 'should change id');
  t.equal(newLayer3.config.visConfig.colorRange, mockColorRange, 'should not deep copy colorRange');
  t.equal(
    newLayer3.config.visConfig.sizeRange,
    LAYER_VIS_CONFIGS.elevationRange.defaultValue,
    'should set sizeRange back to default'
  );

  // change point layer type to icon
  const nextState4 = reducer(nextState2, VisStateActions.layerTypeChange(newLayer2, 'icon'));
  const newLayer4 = nextState4.layers[0];
  t.equal(newLayer4.type, 'icon', 'should change type to icon');
  t.notEqual(newLayer4.id, newLayer2.id, 'should change id');
  t.equal(newLayer4.config.colorField, stringField, 'should keep colorField');
  t.deepEqual(
    newLayer4.config.colorDomain,
    ['driver_analytics', 'driver_analytics_0', 'driver_gps'],
    'should calculate color domain'
  );
  t.equal(newLayer4.config.colorScale, 'ordinal', 'should keep color scale');
  t.equal(newLayer4.config.sizeField, intField, 'should keep sizeField');
  t.equal(newLayer4.config.sizeScale, 'sqrt', 'should scale to linear');
  t.deepEqual(newLayer4.config.sizeDomain, [1, 12124], 'should keep size domain');
  t.deepEqual(newLayer4.config.visConfig.radiusRange, [5, 10], 'should keep size range');
  t.equal(newLayer4.config.visConfig.colorRange, mockColorRange, 'should not deep copy colorRange');
  t.end();
});

test('#visStateReducer -> LAYER_TYPE_CHANGE.3 -> animationConfig', t => {
  const layer = new GeojsonLayer({
    label: 'taro and blue',
    dataId: 'taro',
    columns: {geojson: {fieldIdx: 0, value: '_geojson'}},
    isVisible: true,
    color: [1, 1, 1],
    id: 'taro'
  });

  const dataset = createNewDataEntry({
    info: {id: 'taro'},
    data: processGeojson(tripGeojson)
  });

  const oldState = {
    ...INITIAL_VIS_STATE,
    datasets: dataset,
    layers: [layer],
    layerData: [{}],
    layerOrder: [0]
  };

  // change GeoJson layer to Trip layer
  const nextState = reducer(oldState, VisStateActions.layerTypeChange(layer, 'trip'));

  const foundLayer = nextState.layers[0];
  const foundLayerId = foundLayer.id;
  t.ok(foundLayerId !== 'taro', 'should update layer id');
  t.equal(foundLayer.type, 'trip', 'should update type to trip');
  t.deepEqual(
    foundLayer.config.animation,
    {enabled: true, domain: timeStampDomain},
    'should set correct animation domain'
  );

  t.deepEqual(
    nextState.animationConfig,
    {
      ...DEFAULT_ANIMATION_CONFIG,
      domain: timeStampDomain,
      currentTime: timeStampDomain[0],
      defaultTimeFormat: 'L LTS'
    },
    'should update visState.animationConfig'
  );

  // change Trip layer to Geojson layer
  const nextState2 = reducer(oldState, VisStateActions.layerTypeChange(foundLayer, 'geojson'));
  const foundLayer2 = nextState2.layers[0];
  t.ok(foundLayer2.id !== foundLayerId, 'should update layer id');
  t.equal(foundLayer2.type, 'geojson', 'should update type to trip');

  t.deepEqual(
    foundLayer2.config.animation,
    {enabled: false},
    'should set correct animation domain fro Geojson layer'
  );

  t.deepEqual(
    nextState2.animationConfig,
    DEFAULT_ANIMATION_CONFIG,
    'should set animationConfig to default'
  );

  t.end();
});

test('#visStateReducer -> LAYER_CONFIG_CHANGE -> isVisible -> animationConfig', t => {
  const initialState = StateWTripGeojson;
  const layer = initialState.visState.layers[0];

  // change Trip layer isVisible
  const nextState = reducer(
    StateWTripGeojson.visState,
    VisStateActions.layerConfigChange(layer, {isVisible: false})
  );

  t.deepEqual(
    nextState.animationConfig,
    {
      ...DEFAULT_ANIMATION_CONFIG,
      domain: null,
      currentTime: 1565577261000,
      isAnimating: false
    },
    'should set animationConfig to default'
  );

  const nextState2 = reducer(
    nextState,
    VisStateActions.layerConfigChange(nextState.layers[0], {isVisible: true})
  );

  t.deepEqual(
    nextState2.animationConfig,
    {
      ...nextState2.animationConfig,
      domain: timeStampDomain,
      currentTime: timeStampDomain[0],
      defaultTimeFormat: 'L LTS'
    },
    'should set animationConfig domain and currentTime'
  );

  t.end();
});

test('#visStateReducer -> LAYER_CONFIG_CHANGE -> isVisible -> splitMaps', t => {
  const initialState = StateWSplitMaps.visState;
  const layer = initialState.layers[0];

  const initialSplitMaps = [
    {layers: {'point-0': false, 'geojson-1': true}},
    {layers: {'point-0': true, 'geojson-1': true}}
  ];
  const expectedSplitMaps = [{layers: {'geojson-1': true}}, {layers: {'geojson-1': true}}];
  t.deepEqual(initialState.splitMaps, initialSplitMaps, 'should has the same initial splitMaps');

  const nextState = reducer(
    initialState,
    VisStateActions.layerConfigChange(layer, {isVisible: false})
  );

  t.equal(nextState.layers[0].config.isVisible, false, 'should set layer 0 visibility to false');
  t.equal(initialState.layerData[0], nextState.layerData[0], 'should not update layerData');
  t.deepEqual(nextState.splitMaps, expectedSplitMaps, 'should remove layer from splitMaps');

  const nextState2 = reducer(
    nextState,
    VisStateActions.layerConfigChange(layer, {isVisible: true})
  );

  const initialSplitMaps2 = [
    {layers: {'point-0': true, 'geojson-1': true}},
    {layers: {'point-0': true, 'geojson-1': true}}
  ];
  t.deepEqual(nextState2.splitMaps, initialSplitMaps2, 'should add layer to splitMaps');

  t.end();
});

test('visStateReducer -> layerDataIdChangeUpdater', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor).visState;
  const pointLayer = initialState.layers[0];

  const nextState = reducer(
    initialState,
    VisStateActions.layerConfigChange(pointLayer, {
      dataId: testGeoJsonDataId
    })
  );
  const updatedLayer = nextState.layers[0];

  t.equal(updatedLayer.config.dataId, testGeoJsonDataId, 'should update point layer dataId');
  t.deepEqual(
    updatedLayer.config.columns,
    {
      altitude: {value: null, fieldIdx: -1, optional: true},
      lat: {value: null, fieldIdx: -1},
      lng: {value: null, fieldIdx: -1}
    },
    'should not update point layer column'
  );
  t.equal(updatedLayer.config.colorField, null, 'should not update point layer colorField');

  // add layer
  const nextState1 = reducer(nextState, VisStateActions.addLayer());
  const newLayer = nextState1.layers[nextState1.layers.length - 1];

  const nextState2 = reducer(
    nextState1,
    VisStateActions.layerConfigChange(newLayer, {
      dataId: testGeoJsonDataId,
      color: [1, 2, 3]
    })
  );

  t.equal(
    nextState2.layers[nextState1.layers.length - 1].config.dataId,
    testGeoJsonDataId,
    'should update new layer dataId'
  );
  t.deepEqual(
    nextState2.layers[nextState1.layers.length - 1].config.color,
    [1, 2, 3],
    'should update new layer color'
  );

  t.end();
});

test('visStateReducer -> layerDataIdChangeUpdater -> geojson', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor).visState;
  const nextState = reducer(
    initialState,
    // add another geojson
    VisStateActions.updateVisData([
      {
        info: {id: 'geojson2', label: 'Some Geojson'},
        data: {fields: geojsonFields, rows: geojsonRows.slice(0, 3)}
      }
    ])
  );

  // find geojson layer
  const index = nextState.layers.findIndex(l => l.type === 'geojson');
  const geojsonLayer = nextState.layers[index];
  const id = geojsonLayer.id;
  // change dataId
  const nextState1 = reducer(
    nextState,
    VisStateActions.layerConfigChange(geojsonLayer, {
      dataId: 'geojson2'
    })
  );

  const neextGeojsonLayer = nextState1.layers.find(l => l.id === id);

  t.equal(neextGeojsonLayer.config.dataId, 'geojson2', 'should update layer dataId');
  t.equal(neextGeojsonLayer.dataToFeature.length, 3, 'should calculate dataToFeature');
  t.equal(nextState1.layerData[index].data.length, 3, 'should calculate layerData');

  t.end();
});

test('visStateReducer -> layerDataIdChangeUpdater -> validation', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor).visState;
  const pointLayer = initialState.layers[0];
  const textField = pointLayer.config.textLabel[0].field;

  const newDataInfo = {
    id: 'new-data-csv',
    label: 'new Data'
  };
  const fieldIdx = testFields.findIndex(f => f.name === textField.name);

  // remove 1 field from sample data
  const fields = testFields.filter(f => f.name !== textField.name);
  const rows = testAllData.map(row => [
    ...row.slice(0, fieldIdx),
    ...row.slice(fieldIdx + 1, row.length)
  ]);
  // add another dataset
  const nextState = reducer(
    initialState,
    VisStateActions.updateVisData([{info: newDataInfo, data: {fields, rows}}])
  );

  const nextState1 = reducer(
    nextState,
    VisStateActions.layerConfigChange(pointLayer, {
      dataId: 'new-data-csv'
    })
  );

  const updatedLayer = nextState1.layers[0];
  t.equal(updatedLayer.config.dataId, 'new-data-csv', 'should update point layer dataId');
  t.equal(
    updatedLayer.config.colorField.name,
    'gps_data.types',
    'should update point layer colorField'
  );

  t.deepEqual(
    updatedLayer.config.columns,
    {
      altitude: {value: null, fieldIdx: -1, optional: true},
      lat: {value: 'gps_data.lat', fieldIdx: 1},
      lng: {value: 'gps_data.lng', fieldIdx: 2}
    },
    'should update point layer column'
  );

  t.equal(
    updatedLayer.config.textLabel[0].field,
    undefined,
    'should assign fields not exists to undefined'
  );
  t.end();
});

test('#visStateReducer -> LAYER_VIS_CONFIG_CHANGE -> opacity', t => {
  const initialState = StateWFiles.visState;
  const layer = initialState.layers[0];

  const nextState = reducer(
    initialState,
    VisStateActions.layerVisConfigChange(layer, {opacity: 0.3})
  );

  t.equal(nextState.layers[0].config.visConfig.opacity, 0.3, 'should update layer opacity');
  t.end();
});

test('#visStateReducer -> LAYER_TEXT_LABEL_CHANGE', t => {
  const initialState = StateWFiles.visState;
  // point layer
  const layer = initialState.layers[0];

  t.deepEqual(layer.config.textLabel, [DEFAULT_TEXT_LABEL], 'should set initial textLabel');

  const nextState = reducer(
    initialState,
    VisStateActions.layerTextLabelChange(layer, 0, 'random', 1)
  );

  t.equal(
    nextState.layers[0].config.textLabel,
    layer.config.textLabel,
    'should not update textLabel if prop is not in textLabel'
  );

  const nextState2 = reducer(
    nextState,
    VisStateActions.layerTextLabelChange(nextState.layers[0], 0, 'anchor', 'start')
  );

  t.deepEqual(
    nextState2.layers[0].config.textLabel[0],
    {...DEFAULT_TEXT_LABEL, anchor: 'start'},
    'should start text label prop'
  );

  const valueAccessor = () => 1;
  const expectedField = {
    name: 'taro',
    valueAccessor
  };

  // set text label field
  const nextState3 = reducer(
    nextState2,
    VisStateActions.layerTextLabelChange(nextState2.layers[0], 0, 'field', expectedField)
  );

  const expectedTextLabel1 = {
    ...DEFAULT_TEXT_LABEL,
    anchor: 'start',
    field: expectedField
  };

  t.deepEqual(
    nextState3.layers[0].config.textLabel[0],
    expectedTextLabel1,
    'should set text field'
  );

  // add empty field
  const nextState4 = reducer(
    nextState3,
    VisStateActions.layerTextLabelChange(nextState3.layers[0], 1)
  );

  t.deepEqual(
    nextState4.layers[0].config.textLabel,
    [expectedTextLabel1, DEFAULT_TEXT_LABEL],
    'should add text label'
  );

  // add or remove labels
  const nextState5 = reducer(
    nextState4,
    VisStateActions.layerTextLabelChange(nextState4.layers[0], 'all', 'fields', [
      {name: 'blue', valueAccessor},
      {name: 'taro', valueAccessor}
    ])
  );

  const expected5 = [
    expectedTextLabel1,
    {...DEFAULT_TEXT_LABEL, field: {name: 'blue', valueAccessor}}
  ];
  t.deepEqual(nextState5.layers[0].config.textLabel, expected5, 'should add text label taro');

  // // add 1 more label
  const nextState6 = reducer(
    nextState5,
    VisStateActions.layerTextLabelChange(nextState5.layers[0], 2, 'field', {
      name: 'cat',
      valueAccessor
    })
  );
  const expected6 = [
    expectedTextLabel1,
    {...DEFAULT_TEXT_LABEL, field: {name: 'blue', valueAccessor}},
    {...DEFAULT_TEXT_LABEL, field: {name: 'cat', valueAccessor}}
  ];
  t.deepEqual(nextState6.layers[0].config.textLabel, expected6, 'should add text label cat');

  // remove label
  const nextState7 = reducer(
    nextState6,
    VisStateActions.layerTextLabelChange(nextState6.layers[0], 2, 'field', null)
  );
  const expected7 = [
    expectedTextLabel1,
    {...DEFAULT_TEXT_LABEL, field: {name: 'blue', valueAccessor}}
  ];
  t.deepEqual(nextState7.layers[0].config.textLabel, expected7, 'should remove text label cat');

  // remove label with all
  const nextState8 = reducer(
    nextState7,
    VisStateActions.layerTextLabelChange(nextState7.layers[0], 'all', 'fields', [
      {name: 'blue', valueAccessor}
    ])
  );
  const expected8 = [{...DEFAULT_TEXT_LABEL, field: {name: 'blue', valueAccessor}}];
  t.deepEqual(nextState8.layers[0].config.textLabel, expected8, 'should remove text label blue');

  t.end();
});

test('#visStateReducer -> REORDER_LAYER', t => {
  const newReducer = reducer(
    {layers: [], layerOrder: [0, 1, 2]},
    VisStateActions.reorderLayer([0, 2, 1])
  );

  t.deepEqual(newReducer, {layers: [], layerOrder: [0, 2, 1]}, 'should re order layers');

  t.end();
});

test('#visStateReducer -> UPDATE_LAYER_BLENDING', t => {
  const newReducer = reducer(
    {layerBlending: 'none'},
    VisStateActions.updateLayerBlending('additive')
  );

  t.deepEqual(newReducer, {layerBlending: 'additive'}, 'should update layerBlending');

  t.end();
});

test('#visStateReducer -> REMOVE_FILTER', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  // filter[0]: 'time' testCsvData
  // filter[1]: 'RATE' testGeoJsonData

  const dataset0 = initialState.datasets[testCsvDataId];
  const dataset1 = initialState.datasets[testGeoJsonDataId];

  const expectedData0 = {
    ...dataset0,
    gpuFilter: {
      filterRange: [
        [1474606800000 - 1474588800000, 1474617600000 - 1474588800000],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: 'time',
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [
          {
            index: 0
          }
        ],
        result: [0, 0, 0, 0]
      }
    },
    filterRecord: {
      dynamicDomain: [],
      fixedDomain: [initialState.filters[0]],
      cpu: [],
      gpu: [initialState.filters[0]]
    }
  };

  const expectedData1 = {
    ...dataset1,
    filteredIndex: dataset1.allIndexes,
    filteredIndexForDomain: dataset1.allIndexes,
    filterRecord: {
      dynamicDomain: [],
      fixedDomain: [],
      cpu: [],
      gpu: []
    }
  };

  const expectedFilters = [mergedTimeFilter];

  // remove smoothie filter - gpu: true, fixedDomain: false
  const newReducer = reducer(initialState, VisStateActions.removeFilter(1));

  const expectedLayerData1 = {data: dataset1.dataContainer.mapIndex(d => d)};
  const expectedState = {
    ...initialState,
    filters: expectedFilters,
    datasets: {
      [testCsvDataId]: expectedData0,
      [testGeoJsonDataId]: expectedData1
    },
    layerData: [initialState.layerData[0], expectedLayerData1]
  };

  cmpObjectKeys(t, expectedState, newReducer, 'After removing filter, visState');

  Object.keys(newReducer).forEach(key => {
    switch (key) {
      case 'datasets':
        cmpDatasets(t, expectedState.datasets, newReducer.datasets);
        break;
      case 'filters':
        cmpFilters(t, expectedState.filters, newReducer.filters);
        break;
      case 'layers':
        cmpLayers(t, expectedState.layers, newReducer.layers);
        break;
      case 'layerData':
        // only compare length

        t.equal(
          expectedState.layerData.length,
          newReducer.layerData.length,
          'should have same number of layerData'
        );
        newReducer.layerData.forEach((ld, i) => {
          t.equal(
            expectedState.layerData[i].data.length,
            newReducer.layerData[i].data.length,
            'layerData.data should have same length'
          );
        });
        break;
      default:
        t.deepEqual(
          newReducer[key],
          expectedState[key],
          `visState.${key} should be correct after removing filter`
        );
        break;
    }
  });

  t.end();
});

test('#visStateReducer -> REMOVE_LAYER', t => {
  const layer1 = new PointLayer({id: 'a'});
  const layer2 = new PointLayer({id: 'b'});
  const oldState = {
    layers: [layer1, layer2],
    layerData: [{data: 1}, {data: 2}],
    layerOrder: ['b', 'a'],
    hoverInfo: {
      layer: {props: {id: 'b'}},
      picked: true
    },
    clicked: {
      layer: {props: {id: 'a'}},
      picked: true
    },
    splitMaps: [],
    animationConfig: DEFAULT_ANIMATION_CONFIG
  };

  const newReducer = reducer(oldState, VisStateActions.removeLayer('b'));

  t.deepEqual(
    newReducer,
    {
      layers: [layer1],
      layerData: [{data: 1}],
      layerOrder: ['a'],
      hoverInfo: undefined,
      clicked: {
        layer: {props: {id: 'a'}},
        picked: true
      },
      splitMaps: [],
      animationConfig: DEFAULT_ANIMATION_CONFIG
    },
    'should remove layer and layerData'
  );

  // test remove
  t.end();
});

test('#visStateReducer -> DUPLICATE_LAYER', t => {
  const oldState = CloneDeep(StateWFilesFiltersLayerColor.visState);
  // layers: ['point-0', 'geojson-1', 'hexagon-2'],
  const layerToCopy = serializeLayer(oldState.layers[0], oldState.schema);
  t.equal(oldState.layers.length, 3, 'should have 3 layers to begin');
  t.deepEqual(
    oldState.layerOrder,
    [oldState.layers[2].id, oldState.layers[0].id, oldState.layers[1].id],
    'should have 3 layers to begin'
  );

  const nextState = reducer(oldState, VisStateActions.duplicateLayer(0));
  t.equal(nextState.layers.length, 4, 'should add 1 layer');
  const layerCopied = serializeLayer(nextState.layers[3], nextState.schema);

  const expectedLayer = {
    ...layerToCopy,
    id: layerCopied.id,
    config: {
      ...layerToCopy.config,
      label: 'Copy of gps_data'
    }
  };

  t.deepEqual(layerCopied, expectedLayer, 'should copy layer config correctly');
  t.deepEqual(
    nextState.layerData[3].data,
    nextState.layerData[0].data,
    'should copy layer data correctly'
  );
  t.deepEqual(
    nextState.layerOrder,
    [
      nextState.layers[2].id,
      nextState.layers[3].id,
      nextState.layers[0].id,
      nextState.layers[1].id
    ],
    'should insert copied layer in front of older layer'
  );

  // copy again
  const nextState1 = reducer(nextState, VisStateActions.duplicateLayer(0));
  t.equal(nextState1.layers.length, 5, 'should add 1 layer');
  const layerCopied1 = serializeLayer(nextState1.layers[4], nextState1.schema);

  const expectedLayer1 = {
    ...layerToCopy,
    id: layerCopied1.id,
    config: {
      ...layerToCopy.config,
      label: 'Copy of gps_data 1'
    }
  };
  t.deepEqual(layerCopied1, expectedLayer1, 'should copy layer config correctly');
  t.deepEqual(
    nextState1.layerData[4].data,
    nextState1.layerData[0].data,
    'should copy layer data correctly'
  );
  t.deepEqual(
    nextState1.layerOrder,
    [
      nextState1.layers[2].id,
      nextState1.layers[3].id,
      nextState1.layers[4].id,
      nextState1.layers[0].id,
      nextState1.layers[1].id
    ],
    'should insert copied layer in front of older layer'
  );

  // copy again
  const nextState2 = reducer(nextState1, VisStateActions.duplicateLayer(0));
  t.equal(nextState2.layers.length, 6, 'should add 1 layer');
  const layerCopied2 = serializeLayer(nextState2.layers[5], nextState2.schema);

  const expectedLayer2 = {
    ...layerToCopy,
    id: layerCopied2.id,
    config: {
      ...layerToCopy.config,
      label: 'Copy of gps_data 2'
    }
  };
  t.deepEqual(layerCopied2, expectedLayer2, 'should copy layer config correctly');

  // test remove
  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.1 -> No data', t => {
  const oldState = CloneDeep(InitialState).visState;
  const nextState1 = reducer(oldState, VisStateActions.updateVisData([{info: null, data: null}]));
  t.deepEqual(nextState1, oldState, 'should return current state if no data');

  const nextState2 = reducer(
    oldState,
    VisStateActions.updateVisData([
      {
        data: {
          fields: null,
          rows: [1, 2]
        }
      }
    ])
  );
  t.deepEqual(nextState2, oldState, 'should return current state if no fields');

  Object.keys(oldState).forEach(prop => {
    t.deepEqual(nextState2[prop], oldState[prop], `${prop} should be the same`);
  });
  t.deepEqual(
    reducer(
      oldState,
      VisStateActions.updateVisData([
        {
          data: {
            fields: [{name: 'a'}],
            rows: null
          }
        }
      ])
    ),
    oldState,
    'should return current state if no rows'
  );

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.2 -> to empty state', t => {
  const oldState = INITIAL_VIS_STATE;

  const newState = reducer(
    oldState,
    VisStateActions.updateVisData([
      {
        data: mockRawData,
        info: {id: 'smoothie', label: 'exciting dataset'},
        metadata: {album: 'taro_and_blue'}
      }
    ])
  );

  const expectedDatasets = {
    smoothie: {
      fields: expectedFields,
      filteredIndex: mockRawData.rows.map((_, i) => i),
      filteredIndexForDomain: mockRawData.rows.map((_, i) => i),
      allIndexes: mockRawData.rows.map((_, i) => i),
      dataContainer: createDataContainer(mockRawData.rows, {fields: mockRawData.fields}),
      gpuFilter: {
        filterRange: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0]
        ],
        filterValueUpdateTriggers: {
          gpuFilter_0: null,
          gpuFilter_1: null,
          gpuFilter_2: null,
          gpuFilter_3: null
        },
        filterValueAccessor: {
          inputs: ['a', 'b', 'c', 'd', 'e'],
          result: [0, 0, 0, 0]
        }
      },
      color: 'donnot test me',
      id: 'smoothie',
      label: 'exciting dataset',
      fieldPairs: expectedFieldParis,
      metadata: {id: 'smoothie', label: 'exciting dataset', album: 'taro_and_blue', format: ''},
      type: '',
      supportedFilterTypes: null,
      disableDataOperation: false
    }
  };

  t.deepEqual(Object.keys(newState.datasets), ['smoothie'], 'should save data to smoothie');

  cmpDatasets(t, expectedDatasets, newState.datasets);

  const expectedArcLayer = new ArcLayer({
    dataId: 'smoothie',
    label: 'start_point -> end_point arc',
    columns: {
      lat0: {fieldIdx: 0, value: 'start_point_lat'},
      lng0: {fieldIdx: 1, value: 'start_point_lng'},
      lat1: {fieldIdx: 2, value: 'end_point_lat'},
      lng1: {fieldIdx: 3, value: 'end_point_lng'}
    }
  });

  const expectedLineLayer = new LineLayer({
    dataId: 'smoothie',
    label: 'start_point -> end_point line',
    columns: {
      lat0: {fieldIdx: 0, value: 'start_point_lat'},
      lng0: {fieldIdx: 1, value: 'start_point_lng'},
      lat1: {fieldIdx: 2, value: 'end_point_lat'},
      lng1: {fieldIdx: 3, value: 'end_point_lng'},
      alt0: {
        value: null,
        fieldIdx: -1,
        optional: true
      },
      alt1: {
        value: null,
        fieldIdx: -1,
        optional: true
      }
    }
  });

  const expectedPointLayer1 = new PointLayer({
    dataId: 'smoothie',
    label: 'start_point',
    columns: {
      lat: {fieldIdx: 0, value: 'start_point_lat'},
      lng: {fieldIdx: 1, value: 'start_point_lng'},
      altitude: {fieldIdx: -1, value: null, optional: true}
    },
    isVisible: true
  });

  expectedPointLayer1.meta = {
    bounds: [35.2, 12.25, 37.75, 12.29]
  };

  const expectedPointLayer2 = new PointLayer({
    dataId: 'smoothie',
    label: 'end_point',
    columns: {
      lat: {fieldIdx: 2, value: 'end_point_lat'},
      lng: {fieldIdx: 3, value: 'end_point_lng'},
      altitude: {fieldIdx: -1, value: null, optional: true}
    }
  });

  expectedPointLayer2.meta = {
    bounds: [21.3, 33.1, 100.12, 46.21]
  };

  const expectedLayers = [
    expectedPointLayer1,
    expectedPointLayer2,
    expectedArcLayer,
    expectedLineLayer
  ];

  const newStateLayers = CloneDeep(newState.layers);

  cmpLayers(t, expectedLayers, newStateLayers);

  t.equal(newState.layerData.length, expectedLayers.length, 'should calculate layerdata');
  t.deepEqual(
    newState.layerOrder,
    [newStateLayers[0].id, newStateLayers[1].id, newStateLayers[2].id, newStateLayers[3].id],
    'should calculate layerOrder'
  );

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.3 -> merge w/ existing state', t => {
  const mockLayer = new PointLayer({
    dataId: 'snowflake',
    columns: {
      lat: {
        value: 'start_point_lat',
        fieldIdx: 0
      },
      lng: {
        value: 'start_point_lng',
        fieldIdx: 1
      }
    }
  });
  const snowflake = new KeplerTable({
    data: {
      fields: [{name: 'a'}, {name: 'b'}],
      rows: [['something'], ['something_else']]
    },
    info: {
      id: 'snowflake'
    }
  });

  const oldState = {
    ...INITIAL_VIS_STATE,
    layers: [mockLayer],
    layerData: [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8]
    ],
    datasets: {
      snowflake
    },
    filters: [
      {name: 'hello', dataId: ['a']},
      {name: 'world', dataId: ['b']}
    ],
    interactionConfig: {
      tooltip: {
        id: 'tooltip',
        enabled: true,
        icon: 'messages',
        config: {
          fieldsToShow: {snowflake: ['a']}
        }
      }
    },
    layerOrder: [mockLayer.id],
    layerBlending: 'additive',
    splitMaps: []
  };

  const expectedDatasets = {
    snowflake,
    smoothie: {
      metadata: {
        id: 'smoothie',
        label: 'smoothie and milkshake',
        format: ''
      },
      type: '',
      supportedFilterTypes: null,
      disableDataOperation: false,
      fields: expectedFields,
      dataContainer: createDataContainer(mockRawData.rows, {fields: mockRawData.fields}),
      color: 'donnot test me',
      filteredIndex: mockRawData.rows.map((_, i) => i),
      filteredIndexForDomain: mockRawData.rows.map((_, i) => i),
      allIndexes: mockRawData.rows.map((_, i) => i),
      gpuFilter: {
        filterRange: [
          [0, 0],
          [0, 0],
          [0, 0],
          [0, 0]
        ],
        filterValueUpdateTriggers: {
          gpuFilter_0: null,
          gpuFilter_1: null,
          gpuFilter_2: null,
          gpuFilter_3: null
        },
        filterValueAccessor: {
          inputs: [{data: mockData.data[0], index: 0}],
          result: [0, 0, 0, 0]
        }
      },
      id: 'smoothie',
      label: 'smoothie and milkshake',
      fieldPairs: expectedFieldParis
    }
  };

  const expectedInteractionTooltip = {
    fieldsToShow: {snowflake: ['a'], smoothie: []}
  };

  const newState = reducer(
    oldState,
    VisStateActions.updateVisData([
      {
        data: mockRawData,
        info: {id: 'smoothie', label: 'smoothie and milkshake'}
      }
    ])
  );

  Object.keys(expectedDatasets).forEach(key =>
    cmpDataset(t, expectedDatasets[key], newState.datasets[key])
  );
  t.equal(newState.layers.length, 5, 'should find 1 arc aline and 2 point layers');
  t.deepEqual(
    newState.layerOrder,
    [
      newState.layers[1].id,
      newState.layers[2].id,
      newState.layers[3].id,
      newState.layers[4].id,
      newState.layers[0].id
    ],
    'should add new layer index to layer order, put them on top'
  );
  t.equal(newState.layers[1].config.dataId, 'smoothie', 'should save dataId to layer');
  t.equal(newState.layers[2].config.dataId, 'smoothie', 'should save dataId to layer');
  t.equal(newState.layers[3].config.dataId, 'smoothie', 'should save dataId to layer');
  t.equal(newState.layerData.length, 5, 'should calculate layerData');
  t.equal(newState.filters.length, 2, 'should keep original filters');
  t.deepEqual(
    newState.interactionConfig.tooltip.config,
    expectedInteractionTooltip,
    'should set interaction config back to default'
  );
  t.equal(newState.layerBlending, 'additive', 'should keep layerBlending');

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.4.Geojson -> geojson data', t => {
  const initialVisState = CloneDeep(INITIAL_VIS_STATE);

  const {fields, rows} = processGeojson(CloneDeep(geojsonData));

  const payload = [
    {
      info: {
        id: 'milkshake',
        label: 'king milkshake'
      },
      data: {fields, rows}
    }
  ];

  const [layer1Color, layer1StrokeColor] = getNextColorMakerValue(2);

  // receive data
  const initialState = reducer(initialVisState, VisStateActions.updateVisData(payload));

  const expectedDatasets = {
    metadata: {
      id: 'milkshake',
      label: 'king milkshake',
      format: ''
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false,
    id: 'milkshake',
    label: 'king milkshake',
    color: 'donnot test me',
    dataContainer: createDataContainer(rows, {fields}),
    filteredIndex: rows.map((_, i) => i),
    filteredIndexForDomain: rows.map((_, i) => i),
    allIndexes: rows.map((_, i) => i),
    fields,
    fieldPairs: [],
    gpuFilter: {
      filterRange: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: null,
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [{data: mockData.data[0], index: 0}],
        result: [0, 0, 0, 0]
      }
    }
  };

  const expectedLayer = new GeojsonLayer({
    label: 'king milkshake',
    dataId: 'milkshake',
    columns: {geojson: {fieldIdx: 0, value: '_geojson'}},
    isVisible: true,
    color: layer1Color
  });

  expectedLayer.updateLayerVisConfig({
    stroked: true,
    filled: true,
    strokeColor: layer1StrokeColor
  });
  expectedLayer.dataToFeature = expectedDataToFeature;
  expectedLayer.meta = updatedGeoJsonLayer.meta;

  const expectedLayerData = {
    data: geojsonData.features.map((f, i) => ({
      ...f,
      properties: {...f.properties, TRIPS: f.properties.TRIPS || null, index: i}
    }))
  };

  t.deepEqual(Object.keys(initialState.datasets), ['milkshake'], 'should save geojson to datasets');
  cmpDataset(
    t,
    expectedDatasets,
    initialState.datasets.milkshake,
    'should save correct geojson to datasets'
  );

  t.equal(initialState.layers.length, 1, 'should find 1 geojson layer');
  cmpLayers(t, expectedLayer, initialState.layers[0], 'should save dataFeature to geojson layer');

  t.deepEqual(
    initialState.layerData[0].data,
    expectedLayerData.data,
    'should save geojson to layer data'
  );

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.4.Geojson -> with config', t => {
  const initialVisState = CloneDeep(INITIAL_VIS_STATE);

  const {fields, rows} = processGeojson(CloneDeep(geojsonData));

  const payload = [
    {
      info: {
        id: 'milkshake',
        label: 'king milkshake'
      },
      data: {fields, rows}
    }
  ];

  // receive data
  const initialState = reducer(initialVisState, VisStateActions.updateVisData(payload));

  t.equal(initialState.layers.length, 1, 'should create 1 layer');

  // add data and config again

  // data
  const datasets = [
    {
      info: {
        id: 'milkshake2',
        label: 'king milkshake'
      },
      data: {fields, rows}
    }
  ];

  const config = {
    visState: {
      layers: [
        {
          id: 'test_layer_2',
          type: 'geojson',
          config: {
            dataId: 'milkshake2',
            columns: {
              geojson: '_geojson'
            }
          }
        }
      ]
    }
  };

  const testState = reducer(initialState, VisStateActions.updateVisData(datasets, {}, config));

  t.deepEqual(
    Object.keys(testState.datasets),
    ['milkshake2'],
    'should reset state, and load dataset'
  );
  t.equal(testState.layers.length, 1, 'should create 1 layer');
  t.equal(testState.layers[0].id, 'test_layer_2', 'should merge 1 layer from config');

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA -> mergeFilters', t => {
  const oldState = CloneDeep(INITIAL_VIS_STATE);
  oldState.filterToBeMerged = [
    {
      dataId: 'smoothie',
      id: '38chejr',
      view: FILTER_VIEW_TYPES.enlarged,
      name: mockFilter.name,
      type: mockFilter.type,
      value: mockFilter.value
    },
    {
      dataId: 'nothing_here',
      id: 'vuey55d',
      view: FILTER_VIEW_TYPES.enlarged,
      name: 'test_test',
      type: 'select',
      value: true
    }
  ];

  const expectedFilterProps = {
    domain: [12.249990000000002, 12.290000000000001],
    step: 0.00001,
    histogram: [1], // test not empty
    enlargedHistogram: [2], // test not empty
    fieldType: 'real',
    view: FILTER_VIEW_TYPES.side,
    type: mockFilter.type,
    gpu: true,
    typeOptions: ['range'],
    value: [12.249990000000002, 12.290000000000001]
  };

  const expectedFilter = {
    ...expectedFilterProps,
    animationWindow: 'free',
    dataId: ['smoothie'],
    fieldIdx: [0],
    id: '38chejr',
    freeze: true,
    fixedDomain: false,
    view: FILTER_VIEW_TYPES.enlarged,
    plotType: 'histogram',
    yAxis: null,
    gpu: true,
    gpuChannel: [0],
    interval: null,
    name: [mockFilter.name],
    speed: 1,
    isAnimating: false,
    typeOptions: ['range'],
    value: mockFilter.value
  };

  const newState = reducer(
    oldState,
    VisStateActions.updateVisData([
      {
        data: mockRawData,
        info: {id: 'smoothie', label: 'smoothie and milkshake'}
      }
    ])
  );

  const dc = createDataContainer(mockRawData.rows, {fields: mockRawData.fields});
  const allIndexes = dc.getPlainIndex();

  const expectedDatasets = {
    smoothie: {
      metadata: {
        id: 'smoothie',
        label: 'smoothie and milkshake',
        format: ''
      },
      type: '',
      supportedFilterTypes: null,
      disableDataOperation: false,
      fields: expectedFields.map(f =>
        f.name === mockFilter.name
          ? {
              ...f,
              filterProps: expectedFilterProps
            }
          : f
      ),
      // gpu filter in place, filteredIndex should not be updated
      filteredIndex: allIndexes,
      filteredIndexForDomain: [0],
      filterRecord: {
        dynamicDomain: [newState.filters.find(f => f.id === '38chejr')],
        fixedDomain: [],
        cpu: [],
        gpu: [newState.filters.find(f => f.id === '38chejr')]
      },
      gpuFilter: {
        filterRange: [
          [
            mockFilter.value[0] - expectedFilter.domain[0],
            mockFilter.value[1] - expectedFilter.domain[0]
          ],
          [0, 0],
          [0, 0],
          [0, 0]
        ],
        filterValueUpdateTriggers: {
          gpuFilter_0: mockFilter.name,
          gpuFilter_1: null,
          gpuFilter_2: null,
          gpuFilter_3: null
        },
        filterValueAccessor: {
          inputs: [{index: 0}],
          result: [12.25 - expectedFilter.domain[0], 0, 0, 0]
        }
      },
      allIndexes,
      dataContainer: dc,
      color: 'donot test me',
      id: 'smoothie',
      label: 'smoothie and milkshake',
      fieldPairs: expectedFieldParis,
      changedFilters: {
        dynamicDomain: {'38chejr': 'added'},
        fixedDomain: null,
        cpu: null,
        gpu: {'38chejr': 'added'}
      }
    }
  };

  const expectedState = {
    filterToBeMerged: [oldState.filterToBeMerged[1]],
    filters: [expectedFilter],
    datasets: expectedDatasets
  };

  cmpDatasets(t, expectedState.datasets, newState.datasets);

  t.end();
});

test('#visStateReducer -> UPDATE_VIS_DATA.SPLIT_MAPS', t => {
  const layer0 = new PointLayer({
    dataId: 'snowflake',
    id: 'a',
    isVisible: true
  });

  const layer1 = new PointLayer({
    dataId: 'milkshake',
    id: 'b',
    isVisible: true
  });

  const layer2 = new PointLayer({
    dataId: 'milkshake',
    id: 'c',
    isVisible: false
  });

  const layer3 = new PointLayer({
    dataId: 'milkshake',
    id: 'd',
    isVisible: false
  });

  const layers = [layer0, layer1, layer2, layer3];

  const oldState = {
    ...INITIAL_VIS_STATE,
    layers: [layer0, layer1, layer2, layer3],
    splitMaps: [
      {
        layers: {
          a: true,
          b: false
        }
      },
      {
        layers: {
          a: false,
          b: true
        }
      }
    ],
    interactionConfig: {
      tooltip: {
        config: {
          fieldsToShow: {
            milkshake: []
          }
        }
      }
    },
    layerData: [],
    layerOrder: [layers[2].id, layers[1].id, layers[0].id, layers[3].id]
  };

  const newState = reducer(
    oldState,
    VisStateActions.updateVisData([
      {
        data: mockRawData,
        info: {id: 'smoothie', label: 'smoothie and milkshake'}
      }
    ])
  );

  // first visible layer should be point
  const id1 = newState.layers[4].id;
  const expectedSplitMaps = [
    {
      layers: {
        a: true,
        b: false,
        [id1]: true
      }
    },
    {
      layers: {
        a: false,
        b: true,
        [id1]: true
      }
    }
  ];

  t.equal(newState.layers.length, 8, 'should create 1 arc 1 line and 2 point layers');
  t.deepEqual(
    newState.layerOrder,
    [
      newState.layers[4].id,
      newState.layers[5].id,
      newState.layers[6].id,
      newState.layers[7].id,
      newState.layers[2].id,
      newState.layers[1].id,
      newState.layers[0].id,
      newState.layers[3].id
    ],
    'should move new layers to front'
  );
  t.deepEqual(newState.splitMaps, expectedSplitMaps, 'should add new layers to split maps');

  t.end();
});

test('#visStateReducer -> setFilter.dynamicDomain & cpu', t => {
  // get test data
  const {fields, rows} = processCsvData(testData);
  const payload = [
    {
      info: {
        id: 'smoothie',
        label: 'queen smoothie'
      },
      data: {fields, rows}
    }
  ];

  // receive data
  const initialState = reducer(INITIAL_VIS_STATE, VisStateActions.updateVisData(payload));

  const expectedLayer1 = new PointLayer({
    isVisible: true,
    dataId: 'smoothie',
    label: 'gps_data',
    columns: {
      lat: {value: 'gps_data.lat', fieldIdx: 1},
      lng: {value: 'gps_data.lng', fieldIdx: 2},
      altitude: {value: null, fieldIdx: -1, optional: true}
    }
  });

  expectedLayer1.meta = {
    bounds: [31.2148748, 29.9870074, 31.2590542, 30.0614122]
  };

  const expectedLayers = [expectedLayer1];
  // test default layer
  t.equal(initialState.layers.length, 1, 'should find one layer');

  cmpLayers(t, expectedLayers, initialState.layers);

  // add filter
  const stateWithFilter = reducer(initialState, VisStateActions.addFilter('smoothie'));

  const expectedFilter = {
    dataId: ['smoothie'],
    freeze: false,
    id: 'donnot test me yet',
    enabled: true,
    name: [],
    type: null,
    fixedDomain: false,
    domain: null,
    value: null,
    view: FILTER_VIEW_TYPES.side,
    isAnimating: false,
    animationWindow: 'free',
    plotType: 'histogram',
    yAxis: null,
    speed: 1,
    interval: null,
    gpu: false,
    fieldIdx: []
  };

  cmpFilters(t, expectedFilter, stateWithFilter.filters[0]);
  const filterId = stateWithFilter.filters[0].id;

  // set filter 'name'
  const stateWithFilterName = reducer(
    stateWithFilter,
    VisStateActions.setFilter(0, 'name', 'date')
  );

  const expectedFilterWName = {
    dataId: ['smoothie'],
    freeze: true,
    id: filterId,
    enabled: true,
    name: ['date'],
    type: 'multiSelect',
    fieldIdx: [10],
    fixedDomain: false,
    domain: ['2016-09-23', '2016-09-24', '2016-10-10'],
    value: [],
    view: FILTER_VIEW_TYPES.side,
    isAnimating: false,
    animationWindow: 'free',
    fieldType: 'date',
    plotType: 'histogram',
    yAxis: null,
    speed: 1,
    interval: null,
    gpu: false
  };

  // test filter
  cmpFilters(t, expectedFilterWName, stateWithFilterName.filters[0]);

  const updatedField = {
    ...initialState.datasets.smoothie.fields[10],
    filterProps: {
      type: 'multiSelect',
      value: [],
      fieldType: 'date',
      domain: ['2016-09-23', '2016-09-24', '2016-10-10'],
      gpu: false,
      view: FILTER_VIEW_TYPES.side
    }
  };

  const fieldsEx = [...initialState.datasets.smoothie.fields.slice(0, 10), updatedField];
  const {dataContainer} = initialState.datasets.smoothie;

  // test dataset
  const expectedDataset = {
    metadata: {
      id: 'smoothie',
      label: 'queen smoothie',
      format: ''
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false,
    id: 'smoothie',
    label: 'queen smoothie',
    color: 'donnot test me',
    dataContainer,
    fields: fieldsEx,
    filteredIndex: dataContainer.getPlainIndex(),
    filteredIndexForDomain: dataContainer.getPlainIndex(),
    allIndexes: dataContainer.getPlainIndex(),
    filterRecord: {
      dynamicDomain: [],
      fixedDomain: [],
      cpu: [],
      gpu: []
    },
    gpuFilter: {
      filterRange: [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: null,
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [{index: 0}],
        result: [0, 0, 0, 0]
      }
    },
    fieldPairs: testCsvFieldPairs,
    changedFilters: {dynamicDomain: null, fixedDomain: null, cpu: null, gpu: null}
  };

  cmpDataset(t, expectedDataset, stateWithFilterName.datasets.smoothie);

  // set filter value
  const stateWithFilterValue = reducer(
    stateWithFilterName,
    VisStateActions.setFilter(0, 'value', ['2016-10-10'])
  );

  const expectedFilterWValue = {
    ...expectedFilterWName,
    value: ['2016-10-10']
  };

  // test filter
  cmpFilters(t, expectedFilterWValue, stateWithFilterValue.filters[0]);

  const updatedFilterWValue = stateWithFilterValue.filters[0];
  const expectedFilteredDataset = {
    ...expectedDataset,
    filterRecord: {
      dynamicDomain: [updatedFilterWValue],
      fixedDomain: [],
      cpu: [updatedFilterWValue],
      gpu: []
    },
    dataContainer,
    filteredIndex: [17, 18, 19, 20, 21, 22],
    filteredIndexForDomain: [17, 18, 19, 20, 21, 22],
    changedFilters: {
      dynamicDomain: {[updatedFilterWValue.id]: 'added'},
      fixedDomain: null,
      cpu: {[updatedFilterWValue.id]: 'added'},
      gpu: null
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false
  };

  cmpDataset(t, expectedFilteredDataset, stateWithFilterValue.datasets.smoothie);

  const expectedLayerData1 = {
    data: [
      {index: 17, position: [31.2165983, 30.0538936, 0]},
      {index: 18, position: [31.2148748, 30.060911, 0]},
      {index: 19, position: [31.2212278, 30.060334, 0]},
      {index: 20, position: [31.2288985, 30.0554663, 0]},
      {index: 21, position: [31.2187021, 30.0614122, 0]},
      {index: 22, position: [31.2191059, 30.0612697, 0]}
    ],
    getPosition: () => {},
    getColor: () => {},
    getRadius: () => {}
  };

  t.deepEqual(
    stateWithFilterValue.layerData[0].data,
    expectedLayerData1.data,
    'should format layer data correctly'
  );

  t.end();
});

test('#visStateReducer -> RENAME_DATASET', t => {
  const initialState = StateWTripGeojson.visState;

  t.equal(
    initialState.datasets[tripDataInfo.id].label,
    tripDataInfo.label,
    'Initial label as expected'
  );

  const newLabel = 'New label!!!11';
  const updated = reducer(initialState, VisStateActions.renameDataset(tripDataInfo.id, newLabel));

  assertDatasetIsTable(t, updated.datasets[tripDataInfo.id]);
  t.equal(updated.datasets[tripDataInfo.id].label, newLabel, 'Updated label as expected');

  t.end();
});

test('#visStateReducer -> UPDATE_COLOR_TABLE', t => {
  const initialState = StateWTripGeojson.visState;

  t.deepEqual(
    initialState.datasets[tripDataInfo.id].color,
    [192, 108, 132],
    'Initial color as expected'
  );

  const newColor = [255, 255, 255];
  const updated = reducer(
    initialState,
    VisStateActions.updateTableColor(tripDataInfo.id, newColor)
  );

  assertDatasetIsTable(t, updated.datasets[tripDataInfo.id]);
  t.equal(updated.datasets[tripDataInfo.id].color, newColor, 'Updated color as expected');

  t.end();
});

test('#visStateReducer -> UPDATE_TABLE_PROPS', t => {
  const initialState = StateWTripGeojson.visState;

  // update label
  t.equal(
    initialState.datasets[tripDataInfo.id].label,
    tripDataInfo.label,
    'Initial label as expected'
  );

  const newLabel = 'New label!!!11';
  let updated = reducer(
    initialState,
    VisStateActions.updateDatasetProps(tripDataInfo.id, {label: newLabel})
  );

  assertDatasetIsTable(t, updated.datasets[tripDataInfo.id]);
  t.equal(updated.datasets[tripDataInfo.id].label, newLabel, 'Updated label as expected');

  // update color
  t.deepEqual(
    updated.datasets[tripDataInfo.id].color,
    [192, 108, 132],
    'Initial color as expected'
  );

  const newColor = [255, 255, 255];
  updated = reducer(
    updated,
    VisStateActions.updateDatasetProps(tripDataInfo.id, {color: newColor})
  );
  assertDatasetIsTable(t, updated.datasets[tripDataInfo.id]);
  t.equal(updated.datasets[tripDataInfo.id].label, newLabel, 'Updated color as expected');

  // update meta
  updated = reducer(
    updated,
    VisStateActions.updateDatasetProps(tripDataInfo.id, {metadata: {test: true}})
  );
  assertDatasetIsTable(t, updated.datasets[tripDataInfo.id]);
  t.deepEqual(
    updated.datasets[tripDataInfo.id].metadata,
    {
      ...updated.datasets[tripDataInfo.id].metadata,
      test: true
    },
    'Updated color as expected'
  );

  t.end();
});

test('#visStateReducer -> SET_FILTER.name', t => {
  const oldState = CloneDeep(StateWFilters.visState);
  const oldFilter0 = oldState.filters[0];
  // change filter name from RATE to ZIP_CODE
  const updated = reducer(oldState, VisStateActions.setFilter(1, 'name', 'ZIP_CODE', 0));

  const expectedFilter0 = oldFilter0;
  const expectedFilter1 = {
    dataId: [testGeoJsonDataId],
    freeze: true,
    id: 'RATE-1',
    enabled: true,
    fixedDomain: false,
    view: FILTER_VIEW_TYPES.side,
    isAnimating: false,
    animationWindow: 'free',
    speed: 1,
    name: ['ZIP_CODE'],
    type: 'range',
    fieldIdx: [2],
    domain: [94105, 94111],
    value: [94105, 94111],
    plotType: 'histogram',
    yAxis: null,
    interval: null,
    fieldType: 'integer',
    step: 0.01,
    histogram: [],
    enlargedHistogram: 'dont test me',
    typeOptions: ['range'],
    gpu: true,
    gpuChannel: [0]
  };

  cmpFilters(t, [expectedFilter0, expectedFilter1], updated.filters);

  t.end();
});

test('#visStateReducer -> SET_FILTER.dataId', t => {
  const oldState = CloneDeep(StateWFilters.visState);
  let newState = reducer(oldState, VisStateActions.setFilter(1, 'dataId', testCsvDataId));

  let newFilter = newState.filters[1];
  let expectedFilter = {
    ...getDefaultFilter({dataId: testCsvDataId}),
    id: newFilter.id
  };

  t.deepEqual(newFilter, expectedFilter, 'Should create a new filter using the provided dataId');

  // Using an array of dataId
  newState = reducer(newState, VisStateActions.setFilter(1, 'dataId', [testCsvDataId]));

  newFilter = newState.filters[1];

  expectedFilter = {
    ...getDefaultFilter({dataId: testCsvDataId}),
    id: newFilter.id
  };

  t.deepEqual(
    newFilter,
    expectedFilter,
    'Should create a new filter using the provided list of dataId'
  );

  t.end();
});

function testSetFilterDynamicDomainGPU(t, setFilter) {
  const {fields, rows} = processGeojson(CloneDeep(geojsonData));
  const payload = [
    {
      info: {
        id: 'milkshake',
        label: 'king milkshake'
      },
      data: {fields, rows}
    }
  ];

  // receive data
  const initialState = reducer(INITIAL_VIS_STATE, VisStateActions.updateVisData(payload));

  // add filter
  const stateWithFilter = reducer(initialState, VisStateActions.addFilter('milkshake'));

  // set filter 'name'
  const stateWithFilterName = reducer(stateWithFilter, setFilter(0, 'name', 'TRIPS'));

  const expectedFilterWName = {
    dataId: ['milkshake'],
    freeze: true,
    enabled: true,
    id: stateWithFilter.filters[0].id,
    name: ['TRIPS'],
    type: 'range',
    fieldIdx: [4],
    domain: [4, 20],
    step: 0.01,
    value: [4, 20],
    view: FILTER_VIEW_TYPES.side,
    fixedDomain: false,
    histogram: [],
    enlargedHistogram: [],
    isAnimating: false,
    animationWindow: 'free',
    fieldType: 'integer',
    typeOptions: ['range'],
    plotType: 'histogram',
    yAxis: null,
    interval: null,
    speed: 1,
    gpu: true,
    gpuChannel: [0]
  };

  // test filter
  cmpFilters(t, expectedFilterWName, stateWithFilterName.filters[0]);

  // set filter value
  const stateWithFilterValue = reducer(stateWithFilterName, setFilter(0, 'value', [8, 20]));
  const filterId = stateWithFilterName.filters[0].id;
  const expectedFilterWValue = {
    ...expectedFilterWName,
    value: [8, 20]
  };

  // test filter
  cmpFilters(t, expectedFilterWValue, stateWithFilterValue.filters[0]);

  const expectedFilteredDataset = {
    ...initialState.datasets.milkshake,

    // receive Vis Data will add id to fields
    // filter will add filterProps to fields
    fields: geojsonFields.map((f, i) => ({
      ...f,
      valueAccessor: maybeToDate.bind(
        null,
        // is time
        f.type === ALL_FIELD_TYPES.timestamp,
        i,
        f.format,
        initialState.datasets.milkshake.dataContainer
      ),
      ...(f.name === 'TRIPS' ? {filterProps: geoJsonTripFilterProps} : {})
    })),
    gpuFilter: {
      filterRange: [
        [4, 16],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: 'TRIPS',
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [{index: 0}],
        result: [7, 0, 0, 0]
      }
    },
    filterRecord: {
      dynamicDomain: [stateWithFilterValue.filters[0]],
      fixedDomain: [],
      cpu: [],
      gpu: [stateWithFilterValue.filters[0]]
    },
    filteredIndex: geojsonData.features.map((_, i) => i),
    filteredIndexForDomain: [0, 2],
    allIndexes: geojsonData.features.map((_, i) => i),
    changedFilters: {
      dynamicDomain: {[filterId]: 'value_changed'},
      fixedDomain: null,
      cpu: null,
      gpu: {[filterId]: 'value_changed'}
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false
  };

  const actualTripField = stateWithFilterValue.datasets.milkshake.fields[4];
  const expectedField = expectedFilteredDataset.fields[4];

  cmpField(t, expectedField, actualTripField, 'trip field should be same');
  cmpDataset(t, expectedFilteredDataset, stateWithFilterValue.datasets.milkshake);
}
test('#visStateReducer -> setFilter.dynamicDomain & gpu', t => {
  testSetFilterDynamicDomainGPU(t, VisStateActions.setFilter);
  t.end();
});

test('#visStateReducer -> SET_FILTER_ANIMATION_TIME', t => {
  testSetFilterDynamicDomainGPU(t, VisStateActions.setFilterAnimationTime);
  t.end();
});

test('#visStateReducer -> SET_FILTER_ANIMATION_WINDOW', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  const nextState = reducer(
    initialState,
    VisStateActions.setFilterAnimationWindow({
      id: initialState.filters[0].id,
      animationWindow: 'incremental'
    })
  );

  t.equal(nextState.filters[0].animationWindow, 'incremental', 'should update ANIMATIONWINDOW');

  t.end();
});

test('#visStateReducer -> UPDATE_FILTER_ANIMATION_SPEED', t => {
  const initialState = CloneDeep(StateWFilters.visState);

  const nextState = reducer(initialState, VisStateActions.updateFilterAnimationSpeed(0, 4));

  t.equal(nextState.filters[0].speed, 4, 'should update filter animation speed');

  t.end();
});

test('#visStateReducer -> setFilter.fixedDomain & DynamicDomain & gpu & cpu', t => {
  // get test data
  const {fields, rows} = processCsvData(testData);
  const payload = [
    {
      info: {
        id: 'smoothie',
        label: 'queen smoothie'
      },
      data: {fields, rows}
    }
  ];

  const datasetSmoothie = createNewDataEntry({
    info: {id: 'smoothie', label: 'queen smoothie'},
    data: {
      rows: testAllData,
      fields: testFields
    }
  }).smoothie;

  // add fixedDomain & gpu filter
  const stateWidthTsFilter = applyActions(reducer, INITIAL_VIS_STATE, [
    // receive data
    {action: VisStateActions.updateVisData, payload: [payload]},

    // add ts filter
    {action: VisStateActions.addFilter, payload: ['smoothie']},

    // set ts filter name
    {
      action: VisStateActions.setFilter,
      payload: [0, 'name', 'gps_data.utc_timestamp']
    },

    // set ts filter value
    {
      action: VisStateActions.setFilter,
      payload: [0, 'value', [1474071425000, 1474071740000]]
    }
  ]);

  const filterId = stateWidthTsFilter.filters[0].id;

  const expectedFilterTs = {
    dataId: ['smoothie'],
    freeze: true,
    fixedDomain: true,
    id: filterId,
    name: ['gps_data.utc_timestamp'],
    type: 'timeRange',
    fieldIdx: [0],
    domain: [1474070995000, 1474072208000],
    value: [1474071425000, 1474071740000],
    step: 1000,
    plotType: 'histogram',
    yAxis: null,
    interval: null,
    speed: 1,
    mappedValue: [
      1474070995000,
      1474071056000,
      1474071116000,
      1474071178000,
      1474071240000,
      1474071301000,
      1474071363000,
      1474071425000,
      1474071489000,
      1474071552000,
      1474071567000,
      1474071614000,
      1474071677000,
      1474071740000,
      1474071802000,
      1474071864000,
      1474071928000,
      1474071989000,
      1474072051000,
      1474072115000,
      1474072180000,
      1474072203000,
      1474072203000,
      1474072208000
    ],
    histogram: [],
    enlargedHistogram: [],
    view: FILTER_VIEW_TYPES.enlarged,
    isAnimating: false,
    animationWindow: 'free',
    fieldType: 'timestamp',
    gpu: true,
    gpuChannel: [0],
    defaultTimeFormat: 'L LTS'
  };

  // cmpFilters(t, expectedFilterTs, stateWidthTsFilter.filters[0]);

  const expectedDatasetSmoothie = {
    ...datasetSmoothie,
    // add filter prop to fields
    fields: datasetSmoothie.fields.map(f =>
      f.name === 'gps_data.utc_timestamp'
        ? {
            ...f,
            filterProps: {
              domain: [1474070995000, 1474072208000],
              step: 1000,
              mappedValue: expectedFilterTs.mappedValue,
              histogram: stateWidthTsFilter.filters[0].histogram,
              enlargedHistogram: stateWidthTsFilter.filters[0].enlargedHistogram,
              fieldType: 'timestamp',
              type: 'timeRange',
              view: FILTER_VIEW_TYPES.enlarged,
              fixedDomain: true,
              value: [1474070995000, 1474072208000],
              gpu: true,
              defaultTimeFormat: 'L LTS'
            }
          }
        : f
    ),
    filterRecord: {
      dynamicDomain: [],
      fixedDomain: [stateWidthTsFilter.filters[0]],
      cpu: [],
      gpu: [stateWidthTsFilter.filters[0]]
    },
    gpuFilter: {
      filterRange: [
        [1474071425000 - 1474070995000, 1474071740000 - 1474070995000],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: 'gps_data.utc_timestamp',
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [{index: 1}],
        result: [61000, 0, 0, 0]
      }
    },
    // copy everything
    filteredIndex: datasetSmoothie.dataContainer.getPlainIndex(),
    filteredIndexForDomain: datasetSmoothie.dataContainer.getPlainIndex(),
    changedFilters: {
      dynamicDomain: null,
      fixedDomain: {[filterId]: 'value_changed'},
      cpu: null,
      gpu: {[filterId]: 'value_changed'}
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false
  };

  // check filter by ts
  cmpDataset(t, expectedDatasetSmoothie, stateWidthTsFilter.datasets.smoothie);

  const stateWidthTsAndNameFilter = applyActions(reducer, stateWidthTsFilter, [
    // add ordinal filter
    {action: VisStateActions.addFilter, payload: ['smoothie']},

    // set ordinal filter name
    {
      action: VisStateActions.setFilter,
      payload: [1, 'name', 'date']
    },

    // set ordinal filter value
    {
      action: VisStateActions.setFilter,
      payload: [1, 'value', ['2016-09-24', '2016-10-10']]
    }
  ]);

  const filterId1 = stateWidthTsAndNameFilter.filters[1].id;

  const expectedFilteredDataset = {
    ...stateWidthTsFilter.datasets.smoothie,
    fields: stateWidthTsFilter.datasets.smoothie.fields.map(f =>
      f.name === 'date'
        ? {
            ...f,
            filterProps: {
              domain: ['2016-09-23', '2016-09-24', '2016-10-10'],
              fieldType: 'date',
              type: 'multiSelect',
              value: [],
              gpu: false,
              view: FILTER_VIEW_TYPES.side
            }
          }
        : f
    ),
    gpuFilter: {
      filterRange: [
        [1474071425000 - 1474070995000, 1474071740000 - 1474070995000],
        [0, 0],
        [0, 0],
        [0, 0]
      ],
      filterValueUpdateTriggers: {
        gpuFilter_0: 'gps_data.utc_timestamp',
        gpuFilter_1: null,
        gpuFilter_2: null,
        gpuFilter_3: null
      },
      filterValueAccessor: {
        inputs: [{index: 1}],
        result: [61000, 0, 0, 0]
      }
    },
    filterRecord: {
      dynamicDomain: [stateWidthTsAndNameFilter.filters[1]],
      fixedDomain: [stateWidthTsAndNameFilter.filters[0]],
      cpu: [stateWidthTsAndNameFilter.filters[1]],
      gpu: [stateWidthTsAndNameFilter.filters[0]]
    },
    filteredIndex: [7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22],
    filteredIndexForDomain: [7, 8, 9, 10, 11, 12, 17, 18, 19, 20, 21, 22],
    changedFilters: {
      dynamicDomain: {[filterId1]: 'added'},
      fixedDomain: null,
      cpu: {[filterId1]: 'added'},
      gpu: null
    },
    type: '',
    supportedFilterTypes: null,
    disableDataOperation: false
  };

  cmpDataset(t, expectedFilteredDataset, stateWidthTsAndNameFilter.datasets.smoothie);

  t.end();
});

test('#visStateReducer -> SET_FILTER_PLOT', t => {
  // get test data
  const {fields, rows} = processCsvData(testData);
  const payload = [
    {
      info: {
        id: 'smoothie',
        label: 'queen smoothie'
      },
      data: {fields, rows}
    }
  ];

  // receive data
  const initialState = reducer(INITIAL_VIS_STATE, VisStateActions.updateVisData(payload));

  // add filter
  const stateWithFilter = reducer(initialState, VisStateActions.addFilter('smoothie'));
  const filterId = stateWithFilter.filters[0].id;

  // set filter 'name' to timestamp field
  const stateWithFilterName = reducer(
    stateWithFilter,
    VisStateActions.setFilter(0, 'name', 'gps_data.utc_timestamp')
  );

  // find id which is an integer field
  const yAxisField = stateWithFilterName.datasets.smoothie.fields.find(f => f.name === 'uid');

  // set filterPlot yAxis
  const stateWithFilterPlot = reducer(
    stateWithFilterName,
    VisStateActions.setFilterPlot(0, {yAxis: yAxisField})
  );

  const expectedFilterWName = {
    ...getDefaultFilter({dataId: 'smoothie'}),
    freeze: true,
    fixedDomain: true,
    id: filterId,
    name: ['gps_data.utc_timestamp'],
    type: 'timeRange',
    fieldIdx: [0],
    domain: [1474070995000, 1474072208000],
    value: [1474070995000, 1474072208000],
    step: 1000,
    plotType: 'lineChart',
    yAxis: yAxisField,
    interval: null,
    lineChart: {
      series: [
        {x: 1474070995000, y: 1},
        {x: 1474071056000, y: 2},
        {x: 1474071116000, y: 3},
        {x: 1474071178000, y: 4},
        {x: 1474071240000, y: 5},
        {x: 1474071301000, y: 12124},
        {x: 1474071363000, y: 222},
        {x: 1474071425000, y: 345},
        {x: 1474071864000, y: 1},
        {x: 1474071989000, y: 43},
        {x: 1474072051000, y: 4},
        {x: 1474072115000, y: 5},
        {x: 1474072203000, y: 6},
        {x: 1474072203000, y: 7}
      ],
      yDomain: [1, 12124],
      xDomain: [1474070995000, 1474072203000]
    },
    speed: 1,
    mappedValue: [
      1474070995000,
      1474071056000,
      1474071116000,
      1474071178000,
      1474071240000,
      1474071301000,
      1474071363000,
      1474071425000,
      1474071489000,
      1474071552000,
      1474071567000,
      1474071614000,
      1474071677000,
      1474071740000,
      1474071802000,
      1474071864000,
      1474071928000,
      1474071989000,
      1474072051000,
      1474072115000,
      1474072180000,
      1474072203000,
      1474072203000,
      1474072208000
    ],
    histogram: [],
    enlargedHistogram: [],
    view: FILTER_VIEW_TYPES.enlarged,
    isAnimating: false,
    animationWindow: 'free',
    fieldType: 'timestamp',
    gpu: true,
    gpuChannel: [0],
    defaultTimeFormat: 'L LTS'
  };

  // test filter
  cmpFilters(t, expectedFilterWName, stateWithFilterPlot.filters[0]);
  t.end();
});

test('#visStateReducer -> TOGGLE_FILTER_ANIMATION', t => {
  const initialState = CloneDeep(StateWFilters.visState);

  const nextState = reducer(initialState, VisStateActions.toggleFilterAnimation(0));
  t.equal(nextState.filters[0].isAnimating, true, 'should set filter to isAnimating: true');

  t.end();
});

test('#visStateReducer -> SET_FILTER_VIEW', t => {
  const initialState = CloneDeep(StateWFilters.visState);

  const nextState = reducer(initialState, VisStateActions.setFilterView(0, FILTER_VIEW_TYPES.side));

  t.equal(
    nextState.filters[0].view,
    FILTER_VIEW_TYPES.side,
    'should toggle time filter view to be side'
  );

  const nextState2 = reducer(
    nextState,
    VisStateActions.setFilterView(0, FILTER_VIEW_TYPES.enlarged)
  );

  t.equal(
    nextState2.filters[0].view,
    FILTER_VIEW_TYPES.enlarged,
    'should toggle time filter view to be bottom'
  );

  t.end();
});

test('#visStateReducer -> REMOVE_DATASET', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  const nextState = reducer(initialState, VisStateActions.removeDataset('not_me'));

  t.equal(initialState, nextState, 'should return state if datasetKey doesnot exist');
  t.end();
});

test('#visStateReducer -> REMOVE_DATASET w filter and layer', t => {
  const oldState = CloneDeep(StateWFilters.visState);

  const expectedState = {
    layers: [oldState.layers[1]],
    filters: [oldState.filters[1]],
    layerData: [oldState.layerData[1]],
    layerOrder: [oldState.layers[1].id],
    datasets: {
      [testGeoJsonDataId]: oldState.datasets[testGeoJsonDataId]
    },
    effects: [],
    effectOrder: [],

    interactionConfig: {
      tooltip: {
        id: 'tooltip',
        label: 'interactions.tooltip',
        enabled: true,
        config: {
          compareMode: false,
          compareType: 'absolute',
          fieldsToShow: {
            [testGeoJsonDataId]: [
              {
                name: 'OBJECTID',
                format: null
              },
              {
                name: 'ZIP_CODE',
                format: null
              },
              {
                name: 'ID',
                format: null
              },
              {
                name: 'TRIPS',
                format: null
              },
              {
                name: 'RATE',
                format: null
              }
            ]
          }
        }
      },
      brush: oldState.interactionConfig.brush,
      coordinate: oldState.interactionConfig.coordinate,
      geocoder: oldState.interactionConfig.geocoder
    },
    editingDataset: oldState.editingDataset,
    layerBlending: oldState.layerBlending,
    overlayBlending: oldState.overlayBlending,
    hoverInfo: oldState.hoverInfo,
    clicked: oldState.clicked,
    mousePos: oldState.mousePos,
    maxDefaultTooltips: oldState.maxDefaultTooltips,
    splitMaps: oldState.splitMaps,
    layerClasses: oldState.layerClasses,
    animationConfig: oldState.animationConfig,
    initialState: oldState.initialState,
    layerToBeMerged: [],
    filterToBeMerged: [],
    interactionToBeMerged: {},
    splitMapsToBeMerged: [],
    editor: oldState.editor,
    mapInfo: {
      title: '',
      description: ''
    },
    fileLoading: oldState.fileLoading,
    fileLoadingProgress: oldState.fileLoadingProgress,
    loaders: oldState.loaders,
    loadOptions: oldState.loadOptions,
    mergers: oldState.mergers,
    schema: oldState.schema,
    isMergingDatasets: {}
  };

  const newReducer = reducer(oldState, VisStateActions.removeDataset(testCsvDataId));

  t.deepEqual(
    Object.keys(newReducer).sort(),
    Object.keys(expectedState).sort(),
    `visState should have same keys`
  );
  Object.keys(expectedState).forEach(key => {
    t.deepEqual(newReducer[key], expectedState[key], `newReducer.${key} should be correct`);
  });

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: TOGGLE', t => {
  const layer0 = new ArcLayer({id: 'a', dataId: 'puppy_0', isVisible: true});
  const layer1 = new ArcLayer({id: 'b', dataId: 'puppy_0', isVisible: false});

  const oldState = {
    layers: [layer0, layer1],
    splitMaps: []
  };

  const newReducer = reducer(oldState, MapStateActions.toggleSplitMap());

  t.deepEqual(
    newReducer.splitMaps,
    [
      {
        layers: {
          a: true
        }
      },
      {layers: {}}
    ],
    'should split map'
  );

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: REMOVE_LAYER', t => {
  const layer1 = new PointLayer({id: 'a'});
  const layer2 = new PointLayer({id: 'b'});
  const layers = [layer1, layer2];
  const oldState = {
    layers,
    layerData: [{data: 1}, {data: 2}],
    layerOrder: [layers[1].id, layers[0].id],
    hoverInfo: {
      layer: {props: {id: 'b'}},
      picked: true
    },
    clicked: {
      layer: {props: {id: 'a'}},
      picked: true
    },
    splitMaps: [
      {
        layers: {
          a: true,
          b: true
        }
      },
      {
        layers: {
          a: true,
          b: true
        }
      }
    ],
    animationConfig: DEFAULT_ANIMATION_CONFIG
  };

  const newReducer = reducer(oldState, VisStateActions.removeLayer('b'));

  t.deepEqual(
    newReducer,
    {
      layers: [layer1],
      layerData: [{data: 1}],
      layerOrder: [layer1.id],
      hoverInfo: undefined,
      clicked: {
        layer: {props: {id: 'a'}},
        picked: true
      },
      splitMaps: [
        {
          layers: {
            a: true
          }
        },
        {
          layers: {
            a: true
          }
        }
      ],
      animationConfig: DEFAULT_ANIMATION_CONFIG
    },
    'should remove layer and layerData in split mode'
  );

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: REMOVE_LAYER. set animation domain', t => {
  const layer1 = new PointLayer({id: 'a'});
  const layer2 = new PointLayer({id: 'b'});
  const layer3 = new TripLayer({id: 't1', isVisible: true});
  const layer4 = new TripLayer({id: 't2', isVisible: true});

  layer3.updateAnimationDomain([1568502710000, 1568502960000]);
  layer4.updateAnimationDomain([1568502810000, 1568503060000]);

  const oldState = {
    layers: [layer1, layer2, layer3, layer4],
    layerData: [{data: 1}, {data: 2}, {data: 3}, {data: 4}],
    layerOrder: [1, 0, 2, 3],
    hoverInfo: null,
    clicked: null,
    splitMaps: [],
    animationConfig: {
      domain: [1568502710000, 1568503060000],
      currentTime: 1568502970000
    }
  };

  const newReducer = reducer(oldState, VisStateActions.removeLayer('t1'));
  const expectedAnimationConfig = {
    domain: [1568502810000, 1568503060000],
    currentTime: 1568502970000,
    defaultTimeFormat: 'L LTS'
  };

  t.deepEqual(
    newReducer.animationConfig,
    expectedAnimationConfig,
    'should remove animation layer and adjust animation domain'
  );

  const newReducer2 = reducer(oldState, VisStateActions.removeLayer('t2'));
  const expectedAnimationConfig2 = {
    domain: [1568502710000, 1568502960000],
    currentTime: 1568502710000,
    defaultTimeFormat: 'L LTS'
  };
  t.deepEqual(
    newReducer2.animationConfig,
    expectedAnimationConfig2,
    'should remove animation layer and adjust animation domain'
  );

  const newReducer3 = reducer(newReducer2, VisStateActions.removeLayer('t1'));
  t.deepEqual(
    newReducer3.animationConfig,
    {
      domain: null,
      currentTime: 1568502710000,
      defaultTimeFormat: null
    },
    'remove last animation layer and set animation config to default'
  );

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: REMOVE_DATASET', t => {
  const oldState = StateWSplitMaps.visState;

  const expectedState = {
    layers: [oldState.layers[0]],
    layerData: [oldState.layerData[0]],
    layerOrder: [oldState.layers[0].id],
    datasets: {
      [testCsvDataId]: oldState.datasets[testCsvDataId]
    },
    filters: [],
    effects: [],
    effectOrder: [],
    interactionConfig: {
      tooltip: {
        id: 'tooltip',
        label: 'interactions.tooltip',
        enabled: true,
        config: {
          compareMode: false,
          compareType: 'absolute',
          fieldsToShow: {
            [testCsvDataId]: [
              {
                name: 'gps_data.utc_timestamp',
                format: null
              },
              {
                name: 'gps_data.types',
                format: null
              },
              {
                name: 'epoch',
                format: null
              },
              {
                name: 'has_result',
                format: null
              },
              {
                name: 'uid',
                format: null
              }
            ]
          }
        }
      },
      brush: oldState.interactionConfig.brush,
      coordinate: oldState.interactionConfig.coordinate,
      geocoder: oldState.interactionConfig.geocoder
    },
    splitMaps: [{layers: {'point-0': false}}, {layers: {'point-0': true}}],
    editingDataset: oldState.editingDataset,
    layerBlending: oldState.layerBlending,
    overlayBlending: oldState.overlayBlending,
    hoverInfo: oldState.hoverInfo,
    clicked: oldState.clicked,
    mousePos: oldState.mousePos,
    maxDefaultTooltips: oldState.maxDefaultTooltips,
    layerClasses: oldState.layerClasses,
    animationConfig: DEFAULT_ANIMATION_CONFIG,
    initialState: oldState.initialState,
    layerToBeMerged: [],
    filterToBeMerged: [],
    interactionToBeMerged: {},
    splitMapsToBeMerged: [],
    editor: oldState.editor,
    mapInfo: {
      title: '',
      description: ''
    },
    fileLoading: oldState.fileLoading,
    fileLoadingProgress: oldState.fileLoadingProgress,
    loaders: oldState.loaders,
    loadOptions: oldState.loadOptions,
    schema: oldState.schema,
    mergers: oldState.mergers,
    isMergingDatasets: {}
  };

  const newReducer = reducer(oldState, VisStateActions.removeDataset(testGeoJsonDataId));

  t.deepEqual(
    Object.keys(newReducer).sort(),
    Object.keys(expectedState).sort(),
    `visState should have same keys`
  );
  Object.keys(expectedState).forEach(key => {
    t.deepEqual(newReducer[key], expectedState[key], `newReducer.${key} should be correct`);
  });

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: ADD_LAYER', t => {
  const oldState = {
    datasets: {
      puppy: {
        data: mockData.data,
        fields: mockData.fields
      }
    },
    layers: [{id: 'existing_layer'}],
    layerData: [[{data: [1, 2, 3]}, {data: [4, 5, 6]}]],
    layerOrder: [0],
    splitMaps: [
      {
        layers: {
          existing_layer: true
        }
      },
      {
        layers: {
          existing_layer: true
        }
      }
    ]
  };

  const newReducer = reducer(oldState, VisStateActions.addLayer());

  t.equal(newReducer.layers[1].config.isVisible, true, 'newLayer visibility should be set to true');
  t.equal(
    newReducer.layers[1].config.isConfigActive,
    true,
    'newLayer isConfigActive should be set to true'
  );
  t.equal(newReducer.layers[1].config.dataId, 'puppy', 'newLayer dataId should be set to default');
  t.equal(newReducer.splitMaps.length, 2, 'newLayer was added into splitMaps layers');
  t.deepEqual(
    newReducer.splitMaps[0],
    {
      layers: {
        existing_layer: true,
        [newReducer.layers[1].id]: true
      }
    },
    'newLayer map meta data settings are correct'
  );
  t.deepEqual(
    newReducer.splitMaps[1],
    {
      layers: {
        existing_layer: true,
        [newReducer.layers[1].id]: true
      }
    },
    'newLayer map meta data settings are correct'
  );

  t.end();
});

test('#visStateReducer -> SPLIT_MAP: TOGGLE_SPLIT_MAP', t => {
  const layer0 = new ArcLayer({id: 'a', dataId: 'puppy_0', isVisible: true});
  const layer1 = new PointLayer({id: 'b', dataId: 'puppy_0', isVisible: true});

  const oldState = {
    layers: [layer0, layer1],
    splitMaps: [
      {
        layers: {
          a: true,
          b: true
        }
      },
      {
        layers: {
          a: true,
          b: false
        }
      }
    ]
  };

  const newReducer = reducer(oldState, MapStateActions.toggleSplitMap(0));

  t.equal(newReducer.layers.length, 2, 'should have 2 global layers');
  t.equal(
    newReducer.layers[0].config.isVisible,
    true,
    'global layer should have changed to reflect specific map meta info'
  );
  t.equal(
    newReducer.layers[1].config.isVisible,
    false,
    'global layer should have changed to reflect specific map meta info'
  );
  t.end();
});

test('#visStateReducer -> SPLIT_MAP: HIDE LAYER', t => {
  const oldState = {
    splitMaps: [
      {
        layers: {
          a: true,
          b: true
        }
      },
      {
        layers: {
          a: true,
          b: false
        }
      }
    ]
  };

  const newState = reducer(oldState, VisStateActions.toggleLayerForMap(1, 'a'));

  const expectedState = {
    splitMaps: [
      {
        layers: {
          a: true,
          b: true
        }
      },
      {
        layers: {
          a: false,
          b: false
        }
      }
    ]
  };

  t.deepEqual(newState.splitMaps, expectedState.splitMaps, 'should hide layer B in split map');

  t.end();
});

test('#visStateReducer -> SET_LAYER_ANIMATION_TIME', t => {
  const initialState = StateWTripGeojson.visState;
  const newState = reducer(initialState, VisStateActions.setLayerAnimationTime(1000));

  t.equal(newState.animationConfig.currentTime, 1000, 'should update animation time');
  t.end();
});

test('#visStateReducer -> UPDATE_LAYER_ANIMATION_SPEED', t => {
  const initialState = StateWTripGeojson.visState;
  const newState = reducer(initialState, VisStateActions.updateLayerAnimationSpeed(1.23));

  t.equal(newState.animationConfig.speed, 1.23, 'should update animation speed');

  t.end();
});

test('#visStateReducer -> TOGGLE_LAYER_ANIMATION', t => {
  const initialState = StateWTripGeojson.visState;
  const newState = reducer(initialState, VisStateActions.toggleLayerAnimation());
  t.equal(newState.animationConfig.isAnimating, true, 'should update animationConfig');
  t.end();
});

test('#visStateReducer -> INTERACTION_CONFIG_CHANGE', t => {
  const brushConfig = {
    ...defaultInteractionConfig.brush,
    enabled: true
  };

  const expectedConfig = {
    ...defaultInteractionConfig,
    brush: brushConfig,
    tooltip: {
      ...defaultInteractionConfig.tooltip,
      enabled: false
    },
    geocoder: {
      ...defaultInteractionConfig.geocoder,
      enabled: false
    }
  };

  const nextState = reducer(
    INITIAL_VIS_STATE,
    VisStateActions.interactionConfigChange(brushConfig)
  );

  t.deepEqual(nextState.interactionConfig, expectedConfig, 'should disable tooltip');

  t.end();
});

test('#visStateReducer -> SHOW_DATASET_TABLE', t => {
  const initialState = StateWFiles.visState;
  const nextState = reducer(initialState, VisStateActions.showDatasetTable('abc'));

  t.equal(nextState.editingDataset, 'abc', 'should set editingDataset');
  t.end();
});

test('#visStateReducer -> MAP_CLICK', t => {
  const initialState = StateWFiles.visState;
  const nextState = reducer(
    initialState,
    VisStateActions.onLayerClick({picked: true, object: 'he'})
  );

  t.deepEqual(
    nextState,
    {...nextState, clicked: {picked: true, object: 'he'}},
    'should set clicked'
  );

  const nextState2 = reducer(nextState, VisStateActions.onMapClick());

  t.equal(nextState2.clicked, null, 'should unset clicked');

  t.end();
});

test('#visStateReducer -> MOUSE_MOVE', t => {
  const initialState = StateWFiles.visState;
  const evt = {
    point: [10, 20],
    lngLat: [37, -122]
  };

  const nextState = reducer(initialState, VisStateActions.onMouseMove(evt));

  t.deepEqual(
    nextState.mousePos,
    {
      ...initialState.mousePos,
      mousePosition: [10, 20],
      coordinate: [37, -122]
    },
    'should set mousePos'
  );

  // disable tooltip
  const tooltipConfig = {
    ...defaultInteractionConfig.tooltip,
    enabled: false
  };

  const nextState1 = reducer(nextState, VisStateActions.interactionConfigChange(tooltipConfig));

  const nextState2 = reducer(
    nextState1,
    VisStateActions.onMouseMove({point: [1, 2], lngLat: [90, 90]})
  );

  t.deepEqual(
    nextState2.mousePos,
    {
      ...initialState.mousePos,
      mousePosition: [10, 20],
      coordinate: [37, -122]
    },
    'should not set mousePos'
  );

  t.end();
});

test('#visStateReducer -> LAYER_COLOR_UI_CHANGE. show dropdown', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor.visState);
  const pointLayer = initialState.layers[0];

  const oldColorRange = CloneDeep(pointLayer.config.visConfig.colorRange);
  // show dropdown
  const nextState = reducer(
    initialState,
    VisStateActions.layerColorUIChange(pointLayer, 'color', {
      showDropdown: 0
    })
  );

  const expectedColorUI = {
    color: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0
    },
    colorRange: DEFAULT_COLOR_UI
  };

  t.deepEqual(
    nextState.layers[0].config.colorUI,
    expectedColorUI,
    'should update colorUI.showDropdown'
  );
  t.deepEqual(
    nextState.layers[0].config.visConfig.colorRange,
    oldColorRange,
    'should not change colorRange'
  );

  const nextState1 = reducer(
    nextState,
    VisStateActions.layerColorUIChange(pointLayer, 'color', {
      showDropdown: false
    })
  );
  t.deepEqual(
    nextState1.layers[0].config.colorUI,
    {color: DEFAULT_COLOR_UI, colorRange: DEFAULT_COLOR_UI},
    'should update colorUI.showDropdown'
  );

  const nextState2 = reducer(
    nextState1,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      showDropdown: 0
    })
  );

  const expectedColorUI2 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: false
      }
    }
  };
  t.deepEqual(
    nextState2.layers[0].config.colorUI,
    expectedColorUI2,
    'should update colorUI.showDropdown, set colorRangeConfig step and reversed'
  );

  t.end();
});

test('#visStateReducer -> LAYER_COLOR_UI_CHANGE. colorRangeConfig.step', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor.visState);
  const pointLayer = initialState.layers[0];

  const oldColorRange = CloneDeep(pointLayer.config.visConfig.colorRange);

  t.equal(oldColorRange.colors.length, 4, 'old color range should have 4 colors');
  // show dropdown
  const prepareState = reducer(
    initialState,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      showDropdown: 0
    })
  );

  // set color range steps
  const nextState = reducer(
    prepareState,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      colorRangeConfig: {steps: 6}
    })
  );

  const expectedColorUI = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 6,
        reversed: false,
        custom: false
      }
    }
  };

  const expectedColorRange = {
    name: 'Uber Viz Sequential 4',
    type: 'sequential',
    category: 'Uber',
    colors: ['#E6FAFA', '#C1E5E6', '#9DD0D4', '#75BBC1', '#4BA7AF', '#00939C']
  };
  t.deepEqual(
    nextState.layers[0].config.colorUI,
    expectedColorUI,
    'should update colorUI.colorRangeConfig.steps'
  );
  t.deepEqual(
    nextState.layers[0].config.visConfig.colorRange,
    expectedColorRange,
    'should update visConfig.colorRange based on step'
  );

  // set color range reverse
  const nextState2 = reducer(
    nextState,
    VisStateActions.layerColorUIChange(nextState.layers[0], 'colorRange', {
      colorRangeConfig: {reversed: true}
    })
  );

  const expectedColorUI2 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 6,
        reversed: true,
        custom: false
      }
    }
  };

  const expectedColorRange2 = {
    name: 'Uber Viz Sequential 4',
    type: 'sequential',
    category: 'Uber',
    colors: ['#00939C', '#4BA7AF', '#75BBC1', '#9DD0D4', '#C1E5E6', '#E6FAFA'],
    reversed: true
  };

  t.deepEqual(
    nextState2.layers[0].config.colorUI,
    expectedColorUI2,
    'should update colorUI.colorRangeConfig.reversed'
  );
  t.deepEqual(
    nextState2.layers[0].config.visConfig.colorRange,
    expectedColorRange2,
    'should update visConfig.colorRange based on reversed'
  );

  // update step when reversed is true
  const nextState3 = reducer(
    nextState,
    VisStateActions.layerColorUIChange(nextState2.layers[0], 'colorRange', {
      colorRangeConfig: {steps: 8}
    })
  );

  const expectedColorUI3 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 8,
        reversed: true,
        custom: false
      }
    }
  };

  const expectedColorRange3 = {
    name: 'Uber Viz Sequential 6',
    type: 'sequential',
    category: 'Uber',
    colors: [
      '#E6FAFA',
      '#C1E5E6',
      '#9DD0D4',
      '#75BBC1',
      '#4BA7AF',
      '#00939C',
      '#108188',
      '#0E7077'
    ].reverse(),
    reversed: true
  };

  t.deepEqual(
    nextState3.layers[0].config.colorUI,
    expectedColorUI3,
    'should update colorUI.colorRangeConfig.steps'
  );
  t.deepEqual(
    nextState3.layers[0].config.visConfig.colorRange,
    expectedColorRange3,
    'should update visConfig.colorRange based on match and set reversed'
  );

  // set to a step that has no match
  const nextState4 = reducer(
    nextState,
    VisStateActions.layerColorUIChange(nextState3.layers[0], 'colorRange', {
      colorRangeConfig: {steps: 11}
    })
  );

  const expectedColorUI4 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 11,
        reversed: true,
        custom: false
      }
    }
  };
  t.deepEqual(
    nextState4.layers[0].config.colorUI,
    expectedColorUI4,
    'should update colorUI.colorRangeConfig to step 11'
  );
  t.deepEqual(
    nextState4.layers[0].config.visConfig.colorRange,
    expectedColorRange3,
    'should note update visConfig.colorRange when no match'
  );

  t.end();
});

test('#visStateReducer -> LAYER_COLOR_UI_CHANGE. custom Palette', t => {
  const initialState = CloneDeep(StateWFilesFiltersLayerColor.visState);
  const pointLayer = initialState.layers[0];

  const oldColorRange = CloneDeep(pointLayer.config.visConfig.colorRange);
  // show dropdown
  const prepareState = reducer(
    initialState,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      showDropdown: 0
    })
  );

  // enable custom
  const nextState = reducer(
    prepareState,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      colorRangeConfig: {custom: true}
    })
  );

  const expectedColorUI = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: oldColorRange.colors
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: true
      }
    }
  };

  t.deepEqual(
    nextState.layers[0].config.colorUI,
    expectedColorUI,
    'should update colorUI.customPalette with current colorRange colors'
  );

  const nextState2 = reducer(
    prepareState,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      customPalette: {colors: ['aaa', 'bbb', 'ccc']}
    })
  );

  const expectedColorUI2 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      ...DEFAULT_COLOR_UI,
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['aaa', 'bbb', 'ccc']
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: true
      }
    }
  };

  t.deepEqual(
    nextState2.layers[0].config.colorUI,
    expectedColorUI2,
    'should update colorUI.customPalette colors'
  );

  // show sketcher
  const nextState3 = reducer(
    nextState2,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      showSketcher: 1
    })
  );

  const expectedColorUI3 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      showSketcher: 1,
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['aaa', 'bbb', 'ccc']
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: true
      }
    }
  };

  t.deepEqual(nextState3.layers[0].config.colorUI, expectedColorUI3, 'should set showSketcher: 1');

  // edit color
  const nextState4 = reducer(
    nextState3,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      customPalette: {
        colors: ['bbb', 'ccc', 'aaa']
      }
    })
  );

  const expectedColorUI4 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      showSketcher: 1,
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['bbb', 'ccc', 'aaa']
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: true
      }
    }
  };

  t.deepEqual(
    nextState4.layers[0].config.colorUI,
    expectedColorUI4,
    'should update colorUI.customPalette colors'
  );

  // apply color
  const nextState5 = reducer(
    nextState4,
    VisStateActions.layerVisConfigChange(nextState4.layers[0], {
      colorRange: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['bbb', 'ccc', 'aaa']
      }
    })
  );

  // close custom palette
  const nextState6 = reducer(
    nextState5,
    VisStateActions.layerColorUIChange(nextState5.layers[0], 'colorRange', {
      colorRangeConfig: {
        custom: false
      }
    })
  );

  const expectedColorUI6 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      showSketcher: 1,
      // keep the customPalette
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['bbb', 'ccc', 'aaa']
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: false
      }
    }
  };

  t.deepEqual(
    nextState6.layers[0].config.colorUI,
    expectedColorUI6,
    'should set colorRangeConfig.custom false'
  );

  t.deepEqual(
    nextState6.layers[0].config.visConfig.colorRange,
    {
      name: 'Custom Palette',
      type: 'custom',
      category: 'Custom',
      colors: ['bbb', 'ccc', 'aaa']
    },
    'should set visConfig.colorRange'
  );

  // open it again
  const nextState7 = reducer(
    nextState6,
    VisStateActions.layerColorUIChange(pointLayer, 'colorRange', {
      colorRangeConfig: {
        custom: true
      }
    })
  );

  const expectedColorUI7 = {
    color: DEFAULT_COLOR_UI,
    colorRange: {
      showSketcher: 1,
      // keep the customPalette
      customPalette: {
        name: 'Custom Palette',
        type: 'custom',
        category: 'Custom',
        colors: ['bbb', 'ccc', 'aaa']
      },
      showDropdown: 0,
      colorRangeConfig: {
        type: 'all',
        steps: 4,
        reversed: false,
        custom: true
      }
    }
  };

  t.deepEqual(
    nextState7.layers[0].config.colorUI,
    expectedColorUI7,
    'should set colorRangeConfig.custom true'
  );
  t.end();
});

test('#visStateReducer -> setFeatures/delete', t => {
  const expectedFeatures = [mockPolygonFeature];
  let newReducer = reducer(INITIAL_VIS_STATE, VisStateActions.setFeatures([mockPolygonFeature]));

  t.deepEqual(newReducer.editor.features, expectedFeatures, 'should add new feature');

  newReducer = reducer(newReducer, VisStateActions.deleteFeature(mockPolygonFeature));

  t.deepEqual(newReducer.editor.features, [], 'Should not have features');

  t.end();
});

test('#visStateReducer -> POLYGON: Add/Remove new polygon feature', t => {
  const expectedFeatures = [mockPolygonFeature];
  let newReducer = reducer(INITIAL_VIS_STATE, VisStateActions.setFeatures([mockPolygonFeature]));

  t.deepEqual(newReducer.editor.features, expectedFeatures, 'should add new feature');

  newReducer = reducer(newReducer, VisStateActions.setSelectedFeature(mockPolygonFeature));

  const updatedFeature = {
    ...mockPolygonFeature,
    geometry: {
      ...mockPolygonFeature.geometry,
      coordinates: [
        [
          [12.0, 30.0],
          [12.0, 36.0],
          [12.5, 36.0],
          [12.0, 30.0]
        ]
      ]
    }
  };

  newReducer = reducer(newReducer, VisStateActions.setFeatures([updatedFeature]));

  t.deepEqual(
    newReducer.editor.selectedFeature.id,
    mockPolygonFeature.id,
    'should set selected feature'
  );

  newReducer = reducer(newReducer, VisStateActions.deleteFeature(mockPolygonFeature));

  t.deepEqual(
    newReducer.editor,
    {
      features: [],
      selectedFeature: null,
      selectionContext: undefined,
      visible: true,
      mode: 'EDIT_VERTEX'
    },
    'Should remove existing feature and set selected feature to null'
  );

  t.end();
});

test('#visStateReducer -> POLYGON: Create polygon filter', t => {
  const state = {
    ...INITIAL_VIS_STATE
  };

  const datasets = [
    {
      data: {
        fields: [
          {
            name: 'start_point_lat',
            format: '',
            fieldIdx: 0,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'start_point_lng',
            format: '',
            fieldIdx: 1,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lat',
            format: '',
            fieldIdx: 2,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lng',
            format: '',
            fieldIdx: 3,
            type: 'real',
            analyzerType: 'FLOAT'
          }
        ],
        rows: mockPolygonData.data
      },
      info: {
        label: 'test.csv',
        size: 144
      }
    }
  ];

  const options = {
    centerMap: true,
    keepExistingConfig: false
  };

  // visStateUpdateVisDataUpdater - creates 4 layers
  let newReducer = reducer(state, VisStateActions.updateVisData(datasets, options, {}));

  // add new polygon feature
  newReducer = reducer(newReducer, VisStateActions.setFeatures([mockPolygonFeature]));

  // set selected feature
  newReducer = reducer(newReducer, VisStateActions.setSelectedFeature(mockPolygonFeature));

  // set it as filter
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[0], mockPolygonFeature)
  );

  const newFilter = newReducer.filters[0];

  const firstDataset = Object.keys(newReducer.datasets)[0];
  const expectedFilter = {
    id: newFilter.id,
    dataId: [firstDataset],
    freeze: false,
    enabled: true,
    fixedDomain: true,
    view: FILTER_VIEW_TYPES.side,
    isAnimating: false,
    animationWindow: 'free',
    speed: 1,
    name: [],
    type: 'polygon',
    fieldIdx: [],
    domain: null,
    value: {
      ...mockPolygonFeature,
      properties: {
        ...mockPolygonFeature.properties,
        isVisible: true,
        filterId: newFilter.id
      }
    },
    plotType: 'histogram',
    yAxis: null,
    interval: null,
    layerId: [newReducer.layers[0].id],
    gpu: false
  };

  t.deepEqual(newFilter, expectedFilter, 'Should have created a polygon filter');

  t.equal(newReducer.layerData[0].data.length, 2, 'Layer Point 1 should only show 2 points');

  t.equal(newReducer.layerData[1].data.length, 2, 'Layer Point 2 should only show 2 points');

  const filterFeature = newReducer.filters[0].value;

  // set polygon filter for the second layer
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[1], filterFeature)
  );

  t.equal(newReducer.filters.length, 1, 'Should still have 1 polygon filter');

  t.equal(newReducer.filters[0].layerId.length, 2, 'Should have two values in filter.layerId');

  t.equal(newReducer.layerData[0].data.length, 0, 'Layer Point 1 should show 0 points');

  t.equal(newReducer.layerData[1].data.length, 0, 'Layer Point 2 show show 0 points');

  // Adding a new dataset - creates extra 4 layers
  newReducer = reducer(newReducer, VisStateActions.updateVisData(datasets, options, {}));

  t.equal(newReducer.layerData[4].data.length, 4, 'Layer Point 5 should full data');

  // Set polygon for a different dataset layer
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[4], filterFeature)
  );

  t.equal(newReducer.filters[0].layerId.length, 3, 'Should 3 values in filter.layerId');

  t.equal(newReducer.filters[0].dataId.length, 2, 'Should have two values in filter.dataId');

  t.equal(newReducer.layerData[4].data.length, 2, 'Layer Point 5 should 2 points because filtered');

  // Remove second layer from filter
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[1], filterFeature)
  );

  t.equal(newReducer.filters[0].layerId.length, 2, 'Should 3 values in filter.layerId');

  t.equal(newReducer.filters[0].dataId.length, 2, 'Should have two values in filter.dataId');

  t.equal(
    newReducer.layerData[0].data.length,
    2,
    'Layer Point 1 show 2 points because we removed layer 2'
  );

  t.equal(newReducer.layerData[4].data.length, 2, 'Layer Point 5 should 2 points because filtered');

  t.equal(
    newReducer.layerData[2].data.length,
    2,
    'Layer Point 2 should still show 2 filters because layer 1 is still filtered'
  );

  t.end();
});

test('#visStateReducer -> POLYGON: Toggle filter feature', t => {
  const state = {
    ...INITIAL_VIS_STATE
  };

  const datasets = [
    {
      data: {
        fields: [
          {
            name: 'start_point_lat',
            format: '',
            fieldIdx: 0,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'start_point_lng',
            format: '',
            fieldIdx: 1,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lat',
            format: '',
            fieldIdx: 2,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lng',
            format: '',
            fieldIdx: 3,
            type: 'real',
            analyzerType: 'FLOAT'
          }
        ],
        rows: mockPolygonData.data
      },
      info: {
        label: 'test.csv',
        size: 144,
        id: 'puppy'
      }
    },
    {
      data: {
        fields: [
          {
            name: 'start_point_lat',
            format: '',
            fieldIdx: 0,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'start_point_lng',
            format: '',
            fieldIdx: 1,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lat',
            format: '',
            fieldIdx: 2,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lng',
            format: '',
            fieldIdx: 3,
            type: 'real',
            analyzerType: 'FLOAT'
          }
        ],
        rows: mockPolygonData.data
      },
      info: {
        label: 'test.csv',
        size: 144,
        id: 'cat'
      }
    }
  ];

  const options = {
    centerMap: true,
    keepExistingConfig: false
  };

  // visStateUpdateVisDataUpdater - creates 4 layers
  let newReducer = reducer(state, VisStateActions.updateVisData(datasets, options, {}));

  newReducer = reducer(newReducer, VisStateActions.addLayer());

  t.equal(newReducer.layers.length, 9, 'Should have created a new layer');

  // add new polygon feature
  newReducer = reducer(newReducer, VisStateActions.setFeatures([mockPolygonFeature]));

  // set selected feature
  newReducer = reducer(newReducer, VisStateActions.setSelectedFeature(mockPolygonFeature));

  // set it as filter
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[0], mockPolygonFeature)
  );

  const newFilter = newReducer.filters[0];

  const expectedFilter = {
    id: newFilter.id,
    dataId: ['puppy'],
    freeze: false,
    enabled: true,
    fixedDomain: true,
    view: FILTER_VIEW_TYPES.side,
    isAnimating: false,
    animationWindow: 'free',
    speed: 1,
    name: [],
    type: 'polygon',
    fieldIdx: [],
    domain: null,
    value: {
      ...mockPolygonFeature,
      properties: {
        ...mockPolygonFeature.properties,
        isVisible: true,
        filterId: newFilter.id
      }
    },
    plotType: 'histogram',
    yAxis: null,
    interval: null,
    layerId: [newReducer.layers[0].id],
    gpu: false
  };

  t.deepEqual(newFilter, expectedFilter, 'Should have created a polygon filter');

  let filterFeature = newReducer.filters[0].value;

  t.deepEqual(
    filterFeature.properties.isVisible,
    true,
    'Should have feature visibility set to true'
  );
  t.deepEqual(
    newReducer.datasets.puppy.filteredIndex,
    [0, 2],
    'The polygon filter should be applied'
  );

  newReducer = reducer(newReducer, VisStateActions.toggleFilterFeature(0));

  filterFeature = newReducer.filters[0].value;
  t.deepEqual(filterFeature.properties.isVisible, false, 'Should hide filter feature');
  t.deepEqual(newReducer.filters[0].enabled, false, 'Should disable the filter');
  t.deepEqual(
    newReducer.datasets.puppy.filteredIndex,
    [0, 1, 2, 3],
    "The polygon filter shouldn't be applied"
  );

  t.end();
});

test('#visStateReducer -> POLYGON: delete polygon filter', t => {
  const state = {
    ...INITIAL_VIS_STATE
  };

  const datasets = [
    {
      data: {
        fields: [
          {
            name: 'start_point_lat',
            format: '',
            fieldIdx: 0,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'start_point_lng',
            format: '',
            fieldIdx: 1,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lat',
            format: '',
            fieldIdx: 2,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lng',
            format: '',
            fieldIdx: 3,
            type: 'real',
            analyzerType: 'FLOAT'
          }
        ],
        rows: mockPolygonData.data
      },
      info: {
        label: 'test.csv',
        size: 144,
        id: 'puppy'
      }
    },
    {
      data: {
        fields: [
          {
            name: 'start_point_lat',
            format: '',
            fieldIdx: 0,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'start_point_lng',
            format: '',
            fieldIdx: 1,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lat',
            format: '',
            fieldIdx: 2,
            type: 'real',
            analyzerType: 'FLOAT'
          },
          {
            name: 'end_point_lng',
            format: '',
            fieldIdx: 3,
            type: 'real',
            analyzerType: 'FLOAT'
          }
        ],
        rows: mockPolygonData.data
      },
      info: {
        label: 'test.csv',
        size: 144,
        id: 'cat'
      }
    }
  ];

  const options = {
    centerMap: true,
    keepExistingConfig: false
  };

  // visStateUpdateVisDataUpdater - creates 4 layers
  let newReducer = reducer(state, VisStateActions.updateVisData(datasets, options, {}));

  newReducer = reducer(newReducer, VisStateActions.addLayer());

  t.equal(newReducer.layers.length, 9, 'Should have created a new layer');

  // add new polygon feature
  newReducer = reducer(newReducer, VisStateActions.setFeatures([mockPolygonFeature]));

  // set selected feature
  newReducer = reducer(newReducer, VisStateActions.setSelectedFeature(mockPolygonFeature));

  // set it as filter
  newReducer = reducer(
    newReducer,
    VisStateActions.setPolygonFilterLayer(newReducer.layers[0], mockPolygonFeature)
  );

  // Update filters using setFilter
  newReducer = reducer(newReducer, VisStateActions.setFilter(0, 'layerId', []));

  t.deepEqual(newReducer.filters[0].layerId, [], 'Should have removed layers from filter');

  t.deepEqual(newReducer.filters[0].dataId, [], 'Should have removed datasets from filter');

  // unset it as filter
  newReducer = reducer(newReducer, VisStateActions.removeFilter(0));

  t.deepEqual(newReducer.filters, [], 'Should have removed the created polygon filter');

  // deleting the filter will also delete the feature
  t.deepEqual(newReducer.editor.features.length, 0, 'Should have removed the feature');

  t.end();
});

test('#visStateReducer -> POLYGON: setPolygonFilterLayer: H3', t => {
  const initialState = CloneDeep(StateWH3Layer).visState;
  const newState = reducer(
    initialState,
    VisStateActions.setPolygonFilterLayer(initialState.layers[0], mockPolygonFeature2)
  );

  const expectedFilteredIndex = [1, 3, 5, 8];
  t.deepEqual(
    newState.datasets['190vdll3di'].filteredIndex,
    expectedFilteredIndex,
    'should filter data based on h3 layer'
  );
  t.deepEqual(
    newState.layerData[0].data.map(d => d.index),
    [1, 3, 5, 8],
    'should filter layer data'
  );
  t.end();
});

test('#uiStateReducer -> SET_EDITOR_MODE', t => {
  const newState = reducer(INITIAL_VIS_STATE, VisStateActions.setEditorMode(EDITOR_MODES.EDIT));

  t.equal(newState.editor.mode, EDITOR_MODES.EDIT, 'Editor mode should be set to vertex');

  t.end();
});

test('#uiStateReducer -> TOGGLE_EDITOR_VISIBILITY', t => {
  let newState = reducer(INITIAL_VIS_STATE, VisStateActions.toggleEditorVisibility());

  t.equal(newState.editor.visible, false, 'Should set editor visibility to false');

  newState = reducer(newState, VisStateActions.toggleEditorVisibility());

  t.equal(newState.editor.visible, true, 'Should set editor visibility to true');

  t.end();
});

test('#visStateReducer -> APPLY_CPU_FILTER. no filter', t => {
  const initialState = CloneDeep(StateWFiles.visState);
  const dataId = testCsvDataId;
  const previousDataset = initialState.datasets[dataId];

  const nextState = reducer(initialState, VisStateActions.applyCPUFilter(dataId));

  const expectedDataset = {
    ...previousDataset,
    filteredIdxCPU: previousDataset.allIndexes,
    filterRecordCPU: {
      dynamicDomain: [],
      fixedDomain: [],
      cpu: [],
      gpu: []
    }
  };

  cmpDataset(t, expectedDataset, nextState.datasets[dataId]);
  t.end();
});

test('#visStateReducer -> APPLY_CPU_FILTER has gpu filter', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  // dataset has gpu filter
  const dataId = testCsvDataId;
  const previousDataset = initialState.datasets[dataId];
  const gpuFilter = initialState.filters[0];

  const nextState = reducer(initialState, VisStateActions.applyCPUFilter(dataId));

  const expectedDataset = {
    ...previousDataset,
    filteredIdxCPU: [5, 6, 9, 10, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23],
    filterRecordCPU: {
      dynamicDomain: [],
      fixedDomain: [gpuFilter],
      cpu: [gpuFilter],
      gpu: []
    }
  };

  cmpDataset(t, expectedDataset, nextState.datasets[dataId]);

  // calling it again
  const nextState2 = reducer(nextState, VisStateActions.applyCPUFilter(dataId));

  t.equal(
    nextState.datasets[dataId].filteredIdxCPU,
    nextState2.datasets[dataId].filteredIdxCPU,
    'should directly copy filter result when filter has not changed'
  );
  t.end();
});

test('#visStateReducer -> APPLY_CPU_FILTER has cpu filter', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  // dataset has gpu filter
  const dataId = testGeoJsonDataId;
  const previousDataset2 = initialState.datasets[dataId];
  const ordinalFilter = initialState.filters[1];

  const nextState = reducer(initialState, VisStateActions.applyCPUFilter(dataId));

  const expectedDataset = {
    ...previousDataset2,
    filteredIdxCPU: [0],
    filterRecordCPU: {
      dynamicDomain: [],
      fixedDomain: [ordinalFilter],
      cpu: [ordinalFilter],
      gpu: []
    }
  };

  cmpDataset(t, expectedDataset, nextState.datasets[dataId]);

  const nextState2 = reducer(nextState, VisStateActions.applyCPUFilter(dataId));

  t.equal(
    nextState.datasets[dataId].filteredIdxCPU,
    nextState2.datasets[dataId].filteredIdxCPU,
    'should directly copy filter result when filter has not changed'
  );

  t.end();
});

test('#uiStateReducer -> SET_FEATURES/SET_SELECTED_FEATURE/DELETE_FEATURE', t => {
  let newState = reducer(INITIAL_VIS_STATE, VisStateActions.setFeatures([]));

  t.deepEqual(
    newState,
    INITIAL_VIS_STATE,
    'Editor should not have features and return the same state'
  );

  newState = reducer(
    INITIAL_VIS_STATE,
    VisStateActions.setFeatures([
      {
        ...mockPolygonFeature,
        properties: {
          ...mockPolygonFeature.properties,
          isClosed: false
        }
      }
    ])
  );

  t.equal(
    newState.editor.mode,
    INITIAL_VIS_STATE.editor.mode,
    'Editor mode should not change because feature is not closed'
  );

  newState = reducer(
    newState,
    VisStateActions.setFeatures([
      {
        ...mockPolygonFeature,
        properties: {
          ...mockPolygonFeature.properties,
          isClosed: false
        }
      },
      mockPolygonFeature
    ])
  );

  t.equal(newState.editor.mode, EDITOR_MODES.EDIT, 'Editor mode should be set to edit_vertex');
  t.end();
});

test('#visStateReducer -> APPLY_CPU_FILTER has multi datasets', t => {
  const initialState = CloneDeep(StateWFilters.visState);
  const previousDataset1 = initialState.datasets[testCsvDataId];
  const previousDataset2 = initialState.datasets[testGeoJsonDataId];
  const gpuFilter = initialState.filters[0];
  const ordinalFilter = initialState.filters[1];

  const nextState = reducer(
    initialState,
    VisStateActions.applyCPUFilter([testCsvDataId, testGeoJsonDataId])
  );

  const expectedDataset1 = {
    ...previousDataset1,
    filteredIdxCPU: [5, 6, 9, 10, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23],
    filterRecordCPU: {
      dynamicDomain: [],
      fixedDomain: [gpuFilter],
      cpu: [gpuFilter],
      gpu: []
    }
  };

  const expectedDataset2 = {
    ...previousDataset2,
    filteredIdxCPU: [0],
    filterRecordCPU: {
      dynamicDomain: [],
      fixedDomain: [ordinalFilter],
      cpu: [ordinalFilter],
      gpu: []
    }
  };

  const expectedDatasets = {
    [testCsvDataId]: expectedDataset1,
    [testGeoJsonDataId]: expectedDataset2
  };

  cmpDatasets(t, expectedDatasets, nextState.datasets);

  t.end();
});

test('#visStateReducer -> SORT_TABLE_COLUMN', t => {
  const initialState = CloneDeep(StateWFiles.visState);

  // sort with default mode
  const nextState = reducer(initialState, VisStateActions.sortTableColumn());
  t.equal(nextState, initialState, 'state should not change when input is given');

  // sort with
  const nextState2 = reducer(
    initialState,
    VisStateActions.sortTableColumn(testCsvDataId, 'gps_data.lat')
  );
  t.ok(nextState2.datasets[testCsvDataId].sortOrder, 'should create sortOrder');

  const expectedOrder = [
    3,
    0,
    2,
    4,
    1,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    14,
    15,
    16,
    17,
    20,
    19,
    18,
    23,
    22,
    21
  ];
  t.deepEqual(nextState2.datasets[testCsvDataId].sortOrder, expectedOrder, 'should sort correctly');
  t.deepEqual(
    nextState2.datasets[testCsvDataId].sortColumn,
    {'gps_data.lat': 'ASCENDING'},
    'should save sortOrder'
  );

  // sort again
  const nextState3 = reducer(
    nextState2,
    VisStateActions.sortTableColumn(testCsvDataId, 'gps_data.lat')
  );

  const expectedOrder3 = [...expectedOrder].reverse();

  t.deepEqual(
    nextState3.datasets[testCsvDataId].sortOrder,
    expectedOrder3,
    'should sort correctly'
  );
  t.deepEqual(
    nextState3.datasets[testCsvDataId].sortColumn,
    {'gps_data.lat': 'DESCENDING'},
    'should correctly sort'
  );

  // unsort
  const nextState4 = reducer(
    nextState3,
    VisStateActions.sortTableColumn(testCsvDataId, 'gps_data.lat', 'UNSORT')
  );
  t.deepEqual(nextState4.datasets[testCsvDataId].sortOrder, null, 'should reset sortOrder');
  t.deepEqual(nextState4.datasets[testCsvDataId].sortColumn, {}, 'should reset sortColumn');

  // sort with mode
  const nextState5 = reducer(
    nextState4,
    VisStateActions.sortTableColumn(testCsvDataId, 'gps_data.lat', 'DESCENDING')
  );

  t.deepEqual(
    nextState5.datasets[testCsvDataId].sortOrder,
    expectedOrder3,
    'should sort correctly'
  );
  t.deepEqual(
    nextState5.datasets[testCsvDataId].sortColumn,
    {'gps_data.lat': 'DESCENDING'},
    'should correctly sort'
  );
  assertDatasetIsTable(t, nextState5.datasets[testCsvDataId]);

  t.end();
});

test('#visStateReducer -> PIN_TABLE_COLUMN', t => {
  const initialState = CloneDeep(StateWFiles.visState);

  // pin with empty arg
  const nextState = reducer(initialState, VisStateActions.pinTableColumn());
  t.equal(nextState, initialState, 'state should not change when input is not given');

  // pin gps_data.lat
  const nextState1 = reducer(
    nextState,
    VisStateActions.pinTableColumn(testCsvDataId, 'gps_data.lat')
  );

  assertDatasetIsTable(t, nextState1.datasets[testCsvDataId]);

  t.deepEqual(
    nextState1.datasets[testCsvDataId].pinnedColumns,
    ['gps_data.lat'],
    'should add to pinned columns'
  );

  // unpin
  const nextState2 = reducer(
    nextState1,
    VisStateActions.pinTableColumn(testCsvDataId, 'gps_data.lat')
  );
  assertDatasetIsTable(t, nextState2.datasets[testCsvDataId]);

  t.deepEqual(
    nextState2.datasets[testCsvDataId].pinnedColumns,
    [],
    'should remove from pinned columns'
  );

  t.end();
});

test('#visStateReducer -> LOAD_FILES', async t => {
  const loadFilesSuccessSpy = sinon.spy(VisStateActions, 'loadFilesSuccess');
  const loadFileErrSpy = sinon.spy(Console, 'warn');
  const initialState = CloneDeep(InitialState).visState;
  const mockResults = {
    data: [
      {value1: 'a', value2: 1},
      {value1: 'b', value2: 2}
    ]
  };
  const mockFiles = [
    {type: 'text/csv', name: 'test-file.csv'},
    {type: 'text/csv', name: 'test-file-2.csv'}
  ];
  // mock async generator
  async function* run(fileName) {
    // Sleep for 100ms, see: https://masteringjs.io/tutorials/fundamentals/sleep
    let percent = 0;
    await new Promise(resolve => setTimeout(resolve, 100));
    while (percent < 1) {
      percent += 1;
      yield {progress: {percent}, fileName, ...mockResults};
    }
  }

  const nextState = reducer(initialState, VisStateActions.loadFiles(mockFiles));
  const [task1, ...more] = drainTasksForTesting();

  t.equal(more.length, 0, 'should ceate 1 task');

  const expectedTask1 = {
    type: 'LOAD_FILE_TASK',
    payload: {
      file: {type: 'text/csv', name: 'test-file.csv'},
      fileCache: [],
      loaders: [],
      loadOptions: {}
    }
  };

  t.comment(JSON.stringify(task1));
  t.equal(task1.type, expectedTask1.type, 'should create LOAD_FILE_TASK task');
  t.deepEqual(task1.payload, expectedTask1.payload, 'should create LOAD_FILE_TASK correct payload');

  const expectedFileLoading = {
    fileCache: [],
    filesToLoad: [{type: 'text/csv', name: 'test-file-2.csv'}],
    onFinish: VisStateActions.loadFilesSuccess
  };
  const expectedFileLoadingProgress = {
    'test-file.csv': {percent: 0, message: 'loading...', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 0, message: '', fileName: 'test-file-2.csv', error: null}
  };

  t.deepEqual(nextState.fileLoading, expectedFileLoading, 'should save fileLoading in state');
  t.deepEqual(
    nextState.fileLoadingProgress,
    expectedFileLoadingProgress,
    'should save fileLoadingProgress in state'
  );

  const asyncIterator = run('test-file.csv');

  // test nextFileBatchUpdater
  const nextState2 = reducer(nextState, succeedTaskInTest(task1, asyncIterator));
  // test LOAD_FILE_TASK success
  const [task2, ...more2] = drainTasksForTesting();
  t.equal(more2.length, 0, 'should ceate 1 task');
  t.equal(task2.type, 'UNWRAP', 'should return an UNWRAP task');
  t.ok(task2.payload instanceof Promise, 'task 2 payload should be a Promise');

  t.equal(
    nextState2.fileLoading,
    nextState.fileLoading,
    'fileLoading should not change for the first batch'
  );
  t.deepEqual(
    nextState2.fileLoadingProgress,
    nextState.fileLoadingProgress,
    'fileLoadingProgress should not change for the first batch'
  );

  // test LOAD_FILE_TASK error
  const err1 = {message: 'error 1'};
  const nextState2Err = reducer(nextState, errorTaskInTest(task1, err1));
  const [task2Err, ...more2err] = drainTasksForTesting();
  t.equal(more2err.length, 0, 'should ceate 1 task');
  const expectedErrProgress = {
    'test-file.csv': {percent: 0, message: 'loading...', fileName: 'test-file.csv', error: err1},
    'test-file-2.csv': {percent: 0, message: '', fileName: 'test-file-2.csv', error: null}
  };
  t.deepEqual(
    nextState2Err.fileLoadingProgress,
    expectedErrProgress,
    'should save error to fileLoadingProgress'
  );
  loadFileErrSpy.calledWith(err1);

  t.equal(
    task2Err.type,
    'DELAY_TASK',
    'should create a DELAY_TASK task when loadFileErr is triggered'
  );
  const nextState3Err = reducer(nextState2Err, succeedTaskInTest(task2Err));
  const [task3Err, ...more3err] = drainTasksForTesting();
  t.equal(more3err.length, 0, 'should ceate 1 task');
  t.equal(task3Err.type, 'LOAD_FILE_TASK', 'should return an LOAD_FILE_TASK');
  t.deepEqual(
    task3Err.payload,
    {
      file: {type: 'text/csv', name: 'test-file-2.csv'},
      fileCache: [],
      loaders: [],
      loadOptions: {}
    },
    'should return an LOAD_FILE_TASK with 2nd file to load'
  );
  const expectedErrFileLoadingProgress = {
    'test-file.csv': {percent: 0, message: 'loading...', fileName: 'test-file.csv', error: err1},
    'test-file-2.csv': {percent: 0, message: 'loading...', fileName: 'test-file-2.csv', error: null}
  };
  t.deepEqual(
    nextState3Err.fileLoadingProgress,
    expectedErrFileLoadingProgress,
    'fileLoadingProgress should update whe calling loadNextfileUpdater'
  );
  t.deepEqual(
    nextState3Err.fileLoading,
    {
      fileCache: [],
      filesToLoad: [],
      onFinish: VisStateActions.loadFilesSuccess
    },
    'fileLoading should not add result to fileCache when error'
  );

  // UNWRAP Task success
  const unwrapSuccess = await task2.payload;
  const resultState3 = reducer(nextState2, succeedTaskInTest(task2, unwrapSuccess));

  // should return another unwrap task
  const [task3, ...more3] = drainTasksForTesting();
  t.equal(more3.length, 0, 'should ceate 1 task');
  t.equal(task3.type, 'UNWRAP', 'should return an UNWRAP task');
  t.ok(task3.payload instanceof Promise, 'task 3 payload should be a Promise');
  const expectedFileLoadingProgress3 = {
    'test-file.csv': {percent: 1, message: 'loading...', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 0, message: '', fileName: 'test-file-2.csv', error: null}
  };
  t.equal(
    resultState3.fileLoading,
    nextState2.fileLoading,
    'fileLoading should not change when loadingis not finished'
  );
  t.deepEqual(
    resultState3.fileLoadingProgress,
    expectedFileLoadingProgress3,
    'fileLoadingProgress should update with percent'
  );

  // calling UNWRAP_TASK sucess to create File Process task
  const unwrapSuccess3 = await task3.payload;
  const resultState4 = reducer(resultState3, succeedTaskInTest(task3, unwrapSuccess3));
  const [task4, ...more4] = drainTasksForTesting();

  const expectedFileLoadingProgress4 = {
    'test-file.csv': {percent: 1, message: 'processing...', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 0, message: '', fileName: 'test-file-2.csv', error: null}
  };
  t.equal(resultState3.fileLoading, resultState4.fileLoading, 'fileLoading should be the same');
  t.deepEqual(
    resultState4.fileLoadingProgress,
    expectedFileLoadingProgress4,
    'fileLoadingProgress should update to reflect processing'
  );

  t.equal(more4.length, 0, 'should ceate 1 task');
  const expectedpayload = {
    content: {progress: {percent: 1}, fileName: 'test-file.csv', ...mockResults},
    fileCache: []
  };
  t.equal(task4.type, 'PROCESS_FILE_CONTENT', 'should return an PROCESS_FILE_CONTENT task');
  t.deepEqual(
    task4.payload,
    expectedpayload,
    'PROCESS_FILE_CONTENT task payload should be correct'
  );

  const fileProcessResult = [
    {
      data: [],
      info: {
        label: 'test_data.csv',
        format: 'csv'
      }
    }
  ];

  // calling loadFileStepSuccess with file process result
  const resultState5 = reducer(resultState4, succeedTaskInTest(task4, fileProcessResult));

  const expectedFileLoadingProgress5 = {
    'test-file.csv': {percent: 1, message: 'Done', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 0, message: '', fileName: 'test-file-2.csv', error: null}
  };
  t.deepEqual(
    resultState5.fileLoadingProgress,
    expectedFileLoadingProgress5,
    'fileLoadingProgress should update to show finish'
  );
  t.deepEqual(
    resultState5.fileLoading,
    {
      fileCache: fileProcessResult,
      filesToLoad: [{type: 'text/csv', name: 'test-file-2.csv'}],
      onFinish: VisStateActions.loadFilesSuccess
    },
    'fileLoading should update to add result to fileCache 1'
  );
  const [task5, ...more5] = drainTasksForTesting();
  t.equal(more5.length, 0, 'should ceate 1 task');
  t.equal(task5.type, 'DELAY_TASK', 'should return an DELAY_TASK');

  // calling delayed task succeed to trigger load next file
  const resultState6 = reducer(resultState5, succeedTaskInTest(task5));
  const [task6, ...more6] = drainTasksForTesting();
  t.equal(more6.length, 0, 'should ceate 1 task');
  t.equal(task6.type, 'LOAD_FILE_TASK', 'should return an LOAD_FILE_TASK');
  t.deepEqual(
    task6.payload,
    {
      file: {type: 'text/csv', name: 'test-file-2.csv'},
      fileCache: fileProcessResult,
      loaders: [],
      loadOptions: {}
    },
    'should return an LOAD_FILE_TASK with 2nd file to load 2'
  );
  const expectedFileLoadingProgress6 = {
    'test-file.csv': {percent: 1, message: 'Done', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 0, message: 'loading...', fileName: 'test-file-2.csv', error: null}
  };
  t.deepEqual(
    resultState6.fileLoadingProgress,
    expectedFileLoadingProgress6,
    'fileLoadingProgress should update whe calling loadNextfileUpdater'
  );
  t.deepEqual(
    resultState6.fileLoading,
    {
      fileCache: fileProcessResult,
      filesToLoad: [],
      onFinish: VisStateActions.loadFilesSuccess
    },
    'fileLoading should update to add result to fileCache 3'
  );
  // fast forward so we can test final result
  const asyncIterator2 = run('test-file-2.csv');
  const resultState7 = reducer(resultState6, succeedTaskInTest(task6, asyncIterator2));
  const [task7] = drainTasksForTesting();

  const unwrapSuccess7 = await task7.payload;
  const resultState8 = reducer(resultState7, succeedTaskInTest(task7, unwrapSuccess7));
  const [task8] = drainTasksForTesting();
  const unwrapSuccess8 = await task8.payload;
  const resultState9 = reducer(resultState8, succeedTaskInTest(task8, unwrapSuccess8));
  // process task
  const [task9] = drainTasksForTesting();
  const file2ProcessResult = [
    ...fileProcessResult,
    {
      data: [{value: 1}],
      info: {
        label: 'test_data_2.csv',
        format: 'csv'
      }
    }
  ];
  const resultState10 = reducer(resultState9, succeedTaskInTest(task9, file2ProcessResult));

  const expectedFileLoadingProgress10 = {
    'test-file.csv': {percent: 1, message: 'Done', fileName: 'test-file.csv', error: null},
    'test-file-2.csv': {percent: 1, message: 'Done', fileName: 'test-file-2.csv', error: null}
  };
  t.deepEqual(
    resultState10.fileLoadingProgress,
    expectedFileLoadingProgress10,
    'fileLoadingProgress should update to show finish both files'
  );
  t.deepEqual(
    resultState10.fileLoading,
    {
      fileCache: file2ProcessResult,
      filesToLoad: [],
      onFinish: VisStateActions.loadFilesSuccess
    },
    'fileLoading should update to add 2nd file result to fileCache'
  );
  const [task10, ...more10] = drainTasksForTesting();
  t.equal(more10.length, 0, 'should ceate 1 task');
  t.equal(task10.type, 'DELAY_TASK', 'should return an DELAY_TASK for onFinish');

  // calling delayed task succeed to trigger load next file
  /* eslint-disable no-unused-vars */
  const resultState11 = reducer(resultState10, succeedTaskInTest(task10));

  t.ok(loadFilesSuccessSpy.calledOnce);
  const expectedArgs = [
    {data: [], info: {label: 'test_data.csv', format: 'csv'}},
    {data: [{value: 1}], info: {label: 'test_data_2.csv', format: 'csv'}}
  ];
  t.ok(loadFilesSuccessSpy.calledWith(expectedArgs));
  loadFilesSuccessSpy.restore();

  loadFileErrSpy.restore();
  t.end();
});

test('#visStateReducer -> setLayerAnimationTimeConfig', t => {
  // change Trip layer isVisible
  const nextState = reducer(
    StateWTripGeojson.visState,
    VisStateActions.setLayerAnimationTimeConfig({
      timezone: 'America/New_York',
      timeFormat: 'YYYY-MM-DD',
      random: 1
    })
  );

  t.equal(
    nextState.animationConfig.timezone,
    'America/New_York',
    'should set animationConfig timezone'
  );
  t.equal(
    nextState.animationConfig.timeFormat,
    'YYYY-MM-DD',
    'should set animationConfig timeFormat'
  );
  t.equal(nextState.animationConfig.random, undefined, 'should not set unknown key');
  t.end();
});

test('#visStateReducer -> setFilterAnimationTimeConfig', t => {
  // change Trip layer isVisible
  const nextState = reducer(
    StateWFilters.visState,
    VisStateActions.setFilterAnimationTimeConfig(1, {timezone: 'America/New_York'})
  );

  t.equal(nextState, StateWFilters.visState, 'should not change if is not time filter');

  const nextState1 = reducer(
    StateWFilters.visState,
    VisStateActions.setFilterAnimationTimeConfig(0, {timezone: 'America/New_York'})
  );
  t.equal(nextState1.filters[0].timezone, 'America/New_York', 'should set filter timeFormat');
  t.end();
});

test('VisStateUpdater -> prepareStateForDatasetReplace', t => {
  const oldTooltipConfigFields =
    StateWFilters.visState.interactionConfig.tooltip.config.fieldsToShow;
  const dataIdToUse = 'taro_and_blue';
  const nextState = prepareStateForDatasetReplace(
    StateWFilters.visState,
    testCsvDataId,
    dataIdToUse
  );

  // layers
  t.equal(nextState.layers.length, 1, 'should keep 1 layer');
  t.equal(nextState.layers[0], StateWFilters.visState.layers[1], 'should keep 1 layer');
  t.equal(nextState.layerToBeMerged.length, 1, 'should move 1 layer to layerToBeMerged');
  t.equal(
    nextState.layerToBeMerged[0].id,
    StateWFilters.visState.layers[0].id,
    'should move 1 layer to layerToBeMerged'
  );
  t.equal(nextState.layerToBeMerged[0].config.dataId, dataIdToUse, 'should replace layer dataId');

  // filers
  t.equal(nextState.filters.length, 1, 'should keep 1 filter');
  t.equal(nextState.filters[0], StateWFilters.visState.filters[1], 'should keep 1 filter');
  t.equal(nextState.filterToBeMerged.length, 1, 'should move 1 filter to filterToBeMerged');
  t.equal(
    nextState.filterToBeMerged[0].id,
    StateWFilters.visState.filters[0].id,
    'should move 1 filter to filterToBeMerged'
  );

  t.deepEqual(nextState.filterToBeMerged[0].dataId, [dataIdToUse], 'should replace filter dataId');

  // preserveLayerOrder
  t.deepEqual(
    nextState.layerOrder,
    ['geojson-1', 'point-0'],
    'should not remove layer from layer order'
  );
  t.deepEqual(
    nextState.preserveLayerOrder,
    ['geojson-1', 'point-0'],
    'should save preserved layer order'
  );

  // interactionConfig
  t.deepEqual(
    nextState.interactionConfig.tooltip.config.fieldsToShow,
    {[testGeoJsonDataId]: oldTooltipConfigFields[testGeoJsonDataId]},
    'Should only keep geojson dataset tooltip'
  );
  t.deepEqual(
    nextState.interactionToBeMerged,
    {
      tooltip: {enabled: true, fieldsToShow: {[dataIdToUse]: oldTooltipConfigFields[testCsvDataId]}}
    },
    'should move tooltip config to interactionToBeMerged'
  );

  // preserveDatasetOrder
  t.deepEqual(
    nextState.preserveDatasetOrder,
    [dataIdToUse, testGeoJsonDataId],
    'should save dataset id to preserveDatasetOrder'
  );

  // preserveFilterOrder
  t.deepEqual(
    nextState.preserveFilterOrder,
    ['time-0', 'RATE-1'],
    'should save filter id to preserveFilterOrder'
  );

  t.end();
});

test('VisStateUpdater -> addLayer with empty column', t => {
  const initialState = StateWFiles.visState;
  const oldLayers = initialState.layers;
  let nextState;
  t.doesNotThrow(() => {
    nextState = reducer(
      initialState,
      VisStateActions.addLayer({
        type: 'point',
        id: 'taro-xxx',
        config: {
          dataId: testCsvDataId
          // no column
        }
      })
    );
  }, 'should not throw error when add layer with empty column');

  t.equal(nextState.layers.length, oldLayers.length + 1, 'should create 1 layer');
  const newLayer = nextState.layers[nextState.layers.length - 1];

  t.equal(newLayer.id, 'taro-xxx', 'newlayer should have correct id');
  t.equal(newLayer.type, 'point', 'newlayer should have correct type');
  t.deepEqual(
    newLayer.config.columns.lat,
    {value: null, fieldIdx: -1},
    'newlayer column should be value: null'
  );

  t.deepEqual(
    nextState.layerData[nextState.layerData.length - 1],
    {},
    'newlayer layerData should be empty'
  );

  t.end();
});

test('VisStateUpdater -> applyLayerConfig', t => {
  const initialState = StateWFiles.visState;
  const oldLayers = initialState.layers;

  const oldLayerIndex = 0;
  const oldLayer = oldLayers[oldLayerIndex];
  const oldLayerId = oldLayer.id;
  const {schema} = initialState;
  const layerToJson = layer =>
    schema.getConfigToSave({
      visState: {layers: [layer], layerOrder: [layer.id]}
    }).config.visState.layers?.[0];
  const oldLayerDataset = initialState.datasets[oldLayer.config.dataId];
  const transformConfig = transform => transform(layerToJson(oldLayer, schema));
  const getUpdatedLayerJson = state => layerToJson(state.layers[oldLayerIndex], schema);

  let nextState;

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.config.isVisible = false;
        layer.config.label = 'New label';
        return layer;
      })
    )
  );
  t.equal(getUpdatedLayerJson(nextState).config.isVisible, false, 'should change isVisible');
  t.equal(getUpdatedLayerJson(nextState).config.label, 'New label', 'should change label');

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.config.columns = {
          lng: 'gps_data.lat',
          lat: 'gps_data.lng'
        };
        return layer;
      })
    )
  );
  t.equal(
    getUpdatedLayerJson(nextState).config.columns.lng,
    'gps_data.lat',
    'should change lng column'
  );
  t.equal(
    getUpdatedLayerJson(nextState).config.columns.lat,
    'gps_data.lng',
    'should change lat column'
  );

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.config.textLabel = {field: {name: 'gps_data.types', type: 'string'}};
        return layer;
      })
    )
  );
  t.equal(
    getUpdatedLayerJson(nextState).config.textLabel?.[0]?.field?.name,
    'gps_data.types',
    'should change text label'
  );

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.visualChannels.colorField = {name: 'gps_data.lat', type: 'real'};
        layer.visualChannels.colorScale = 'quantize';
        return layer;
      })
    )
  );
  t.equal(
    getUpdatedLayerJson(nextState).visualChannels.colorField?.name,
    'gps_data.lat',
    'should change visualChannel colorField'
  );
  t.equal(
    getUpdatedLayerJson(nextState).visualChannels.colorScale,
    'quantize',
    'should change visualChannel colorScale'
  );

  t.throws(() => {
    validateLayerWithData(
      oldLayerDataset,
      transformConfig(layer => {
        layer.config.textLabel = {field: {name: 'INVALID', type: 'string'}};
        return layer;
      }),
      initialState.layerClasses,
      {throwOnError: true}
    );
  }, 'validation should throw error for invalid text label');

  t.throws(() => {
    validateLayerWithData(
      oldLayerDataset,
      transformConfig(layer => {
        layer.config.columns = {
          lng: 'INVALID COLUMN'
        };
        return layer;
      }),
      initialState.layerClasses,
      {throwOnError: true}
    );
  }, 'validation should throw error for invalid columns');

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.config.dataId = 'INVALID DATA ID';
        return layer;
      })
    )
  );
  t.equal(
    getUpdatedLayerJson(nextState).config.dataId,
    oldLayer.config.dataId,
    'should not change data id to invalid one'
  );
  t.deepEqual(
    getUpdatedLayerJson(nextState),
    layerToJson(oldLayer, schema),
    'should not change on invalid data id'
  );

  nextState = reducer(
    initialState,
    VisStateActions.applyLayerConfig(
      oldLayerId,
      transformConfig(layer => {
        layer.type = '3D';
        return layer;
      })
    )
  );
  t.equal(getUpdatedLayerJson(nextState).type, '3D', 'should change layer type');

  t.end();
});

test('#VisStateUpdater -> addEffect', t => {
  const initialState = InitialState.visState;

  let nextState = reducer(initialState, VisStateActions.addEffect({}));

  t.equal(nextState.effects.length, 1, 'should add a default effect');

  const expectedEffect = {
    type: 'ink',
    isEnabled: true,
    isConfigActive: true,
    parameters: {strength: 0.25}
  };

  cmpEffects(t, expectedEffect, nextState.effects[0]);

  nextState = reducer(
    nextState,
    VisStateActions.addEffect({
      id: 'e_shadow',
      type: 'lightAndShadow',
      parameters: {timestamp: 1689280466362}
    })
  );

  t.equal(nextState.effects.length, 2, 'should add second effect');

  const expectedEffect2 = {
    id: 'e_shadow',
    type: 'lightAndShadow',
    isConfigActive: true,
    isEnabled: true,
    parameters: {
      timestamp: 1689280466362,
      timeMode: 'pick',
      shadowIntensity: 0.5,
      shadowColor: [0, 0, 0],
      sunLightColor: [255, 255, 255],
      sunLightIntensity: 1,
      ambientLightColor: [255, 255, 255],
      ambientLightIntensity: 1
    }
  };

  cmpEffects(t, expectedEffect2, nextState.effects[1], {id: true});

  t.equal(
    nextState.effects[0].isConfigActive,
    false,
    "first effect's configurator should be collapsed"
  );

  nextState = reducer(nextState, VisStateActions.addEffect({}));

  t.equal(nextState.effectOrder.length, 3, 'should be 3 ids in effectOrder');

  t.equal(nextState.effectOrder[0], 'e_shadow', 'shadow effect should stay as first effect');

  t.end();
});

test('#VisStateUpdater -> updateEffect', t => {
  const initialState = InitialState.visState;

  let nextState = reducer(initialState, VisStateActions.addEffect({id: 'e_1'}));
  nextState = reducer(nextState, VisStateActions.addEffect({}));
  nextState = reducer(nextState, VisStateActions.addEffect({id: 'e_3'}));

  const expectedEffect = {
    id: 'e_1',
    type: 'ink',
    isEnabled: false,
    isConfigActive: false,
    parameters: {
      strength: 0.06
    }
  };

  nextState = reducer(nextState, VisStateActions.updateEffect('e_1', expectedEffect));

  cmpEffects(t, expectedEffect, nextState.effects[0], {id: true});

  // non-existing id, shouldn't fail
  nextState = reducer(nextState, VisStateActions.updateEffect('fake_id', {}));

  // update effect id
  nextState = reducer(nextState, VisStateActions.updateEffect('e_1', {id: 'e_2'}));
  cmpEffects(t, {...expectedEffect, id: 'e_2'}, nextState.effects[0], {id: true});
  t.equal(nextState.effectOrder[2], 'e_2', 'Effect id should be updated');

  // update effect to an existing effect id
  nextState = reducer(nextState, VisStateActions.updateEffect('e_2', {id: 'e_3'}));
  cmpEffects(t, {...expectedEffect, id: 'e_2'}, nextState.effects[0], {id: true});
  t.equal(nextState.effectOrder[2], 'e_2', "Effect id shouldn't be updated");

  t.end();
});

test('#VisStateUpdater -> reorderEffect', t => {
  const initialState = InitialState.visState;

  let nextState = reducer(initialState, VisStateActions.addEffect({id: 'e_1'}));
  nextState = reducer(nextState, VisStateActions.addEffect({id: 'e_2'}));
  nextState = reducer(nextState, VisStateActions.addEffect({id: 'e_3'}));

  t.deepEqual(nextState.effectOrder, ['e_3', 'e_2', 'e_1'], 'effect order should be correct order');

  nextState = reducer(nextState, VisStateActions.reorderEffect(['e_2', 'e_1', 'e_3']));

  t.deepEqual(
    nextState.effectOrder,
    ['e_2', 'e_1', 'e_3'],
    'effect order should be correct after '
  );

  t.end();
});

test('#VisStateUpdater -> removeEffect', t => {
  const initialState = InitialState.visState;

  let nextState = reducer(initialState, VisStateActions.addEffect({id: 'e_1'}));
  nextState = reducer(nextState, VisStateActions.addEffect({id: 'e_2'}));
  nextState = reducer(nextState, VisStateActions.addEffect({id: 'e_3'}));

  nextState = reducer(nextState, VisStateActions.removeEffect('e_2'));

  t.deepEqual(nextState.effects.length, 2, 'effect should be removed');

  t.deepEqual(nextState.effects[0].id, 'e_1', 'e_1 effect should be available');
  t.deepEqual(nextState.effects[1].id, 'e_3', 'e_3 effect should be available');

  // bad id, shouldn't fail
  nextState = reducer(nextState, VisStateActions.removeEffect('e_2'));

  t.equal(nextState.effectOrder.length, 2, 'should be 2 ids in effectOrder');

  t.end();
});
