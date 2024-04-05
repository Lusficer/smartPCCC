const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const actions = require('./actions');
const { DETECTORS } = require('../../constants')();
const config = require('../../constants/config');

const { SMARTPCCC } = DETECTORS || {};

module.exports.recognize = async ({ key }) => {
  const { URL, KEY } = SMARTPCCC;
  const formData = new FormData();
  formData.append('image', fs.createReadStream(key));
  if (KEY) formData.append('api_key', KEY);
  return axios({
    method: 'post',
    timeout: SMARTPCCC.TIMEOUT * 1000,
    headers: {
      ...formData.getHeaders(),
    },
    url: `${URL}/v1/vision/custom/smoke-fire-s`,
    validateStatus() {
      return true;
    },
    data: formData,
  });
};

module.exports.normalize = ({ camera, data }) => {
  if (data.success === false) return [];
  const { MATCH, UNKNOWN } = config.detect(camera);
  const normalized = data.predictions.flatMap((obj) => {
    const confidence = parseFloat((obj.confidence * 100).toFixed(2));
    const output = {
      name: confidence >= UNKNOWN.CONFIDENCE ? obj.label.toLowerCase() : 'unknown',
      confidence,
      match:
        obj.userid !== 'unknown' &&
        confidence >= MATCH.CONFIDENCE &&
        (obj.x_max - obj.x_min) * (obj.y_max - obj.y_min) >= MATCH.MIN_AREA,
      box: {
        top: obj.y_min,
        left: obj.x_min,
        width: obj.x_max - obj.x_min,
        height: obj.y_max - obj.y_min,
      },
    };
    const checks = actions.checks({ MATCH, UNKNOWN, ...output });
    if (checks.length) output.checks = checks;
    return checks !== false ? output : [];
  });
  return normalized;
};
