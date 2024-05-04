const express = require('express');
const axios = require('axios');
const app = express();

const ReplicateUtils = {
  run: async function (model, inputs) {
    let prediction;
    try {
      prediction = await this.create(model, inputs);
    } catch (e) {
      throw e.response.data;
    }
    while (!['canceled', 'succeeded', 'failed'].includes(prediction.status)) {
      await new Promise(_ => setTimeout(_, 250));
      prediction = await this.get(prediction);
    }

    return prediction.output;
  },

  async get(prediction) {
    if (prediction.prediction) return prediction.prediction;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 29000);
    const response = await axios
      .get(
        `https://replicate.com/api/models${prediction.version.model.absolute_url}/versions/${prediction.version_id}/predictions/${prediction.uuid}`,
        {
          signal: controller.signal,
        }
      )
      .then((r) => r.data);
    clearTimeout(id);
    return response;
  },

  create(model, inputs) {
    const [path, version] = model.split(':');

    return axios({
      url: `https://replicate.com/api/models/${path}/versions/${version}/predictions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: JSON.stringify({ inputs }),
    }).then((response) => response.data);
  },
};

const midJourney = async (prompt, parameters = {}) => await ReplicateUtils.run(model, { prompt, ...parameters });

const model = 'cjwbw/animagine-xl-3.1:6afe2e6b27dad2d6f480b59195c221884b6acc589ff4d05ff0e5fc058690fbb9';

async function getStreamFromURL(url) {
  const response = await axios.get(url, { responseType: 'stream' });
  return response.data;
}

app.use(express.json());

app.get('/generate-image', async (req, res) => {
  try {
    const prompt = req.query.prompt;
    const ratio = req.query.ar || '7:4'; // Par défaut, le ratio est 7:4 Horizontal
    const ratioMap = {
      '1:1': '1024x1024',
      '9:7': '1152x896',
      '7:9': '896x1152',
      '19:13': '1216x832',
      '13:19': '832x1216',
      '7:4': '1344x768',
      '4:7': '768x1344',
      '12:5': '1536x640',
      '5:12': '640x1536',
    };

    if (!prompt) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    const data = await midJourney(prompt, { ratio: ratioMap[ratio] });
    const imageUrl = data[0];
    const imageStream = await getStreamFromURL(imageUrl);

    res.set('Content-Type', 'image/png');
    imageStream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
