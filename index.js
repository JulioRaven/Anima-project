const express = require('express');
const axios = require('axios');
const app = express();

const ReplicateUtils = {
	run: async function (model, inputs) {
		let prediction;
		try {
			prediction = await this.create(model, inputs);
		}
		catch (e) {
			throw e.response.data;
		}
		while (![
			'canceled',
			'succeeded',
			'failed'
		].includes(prediction.status)) {
			await new Promise(_ => setTimeout(_, 250));
			prediction = await this.get(prediction);
		}

		return prediction.output;
	},

	async get(prediction) {
		if (prediction.prediction)
			return prediction.prediction;
		const controller = new AbortController();
		const id = setTimeout(() => controller.abort(), 29000);
		const response = await axios.get(`https://replicate.com/api/models${prediction.version.model.absolute_url}/versions/${prediction.version_id}/predictions/${prediction.uuid}`, {
			signal: controller.signal
		}).then(r => r.data);
		clearTimeout(id);
		return response;
	},

	create(model, inputs) {
		const [path, version] = model.split(':');

		return axios({
			url: `https://replicate.com/api/models/${path}/versions/${version}/predictions`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: JSON.stringify({ inputs })
		})
			.then(response => response.data);
	}
};

const midJourney = async (prompt, parameters = {}) => await ReplicateUtils.run(model, { prompt, ...parameters });

const model = "cjwbw/anything-v3.0:f410ed4c6a0c3bf8b76747860b3a3c9e4c8b5a827a16eac9dd5ad9642edce9a2";
/* Change Model As You Want

cjwbw/anything-v3.0:f410ed4c6a0c3bf8b76747860b3a3c9e4c8b5a827a16eac9dd5ad9642edce9a2

stability-ai/sdxl:2b017d9b67edd2ee1401238df49d75da53c523f36e363881e057f5dc3ed3c5b2

*/

async function getStreamFromURL(url) {
  const response = await axios.get(url, { responseType: 'stream' });
  return response.data;
}

app.use(express.json());

app.get('/generate-image', async (req, res) => {
  try {
    const prompt = req.query.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }

    const data = await midJourney(prompt, {});
    const imageUrl = data[0];
    const imageStream = await getStreamFromURL(imageUrl, "openjourney.png");

    res.set('Content-Type', 'image/png');
    imageStream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
