from flask import Flask, render_template, request, jsonify
from pymongo import MongoClient
import pickle
import numpy as np
import os
from dotenv import load_dotenv
from datetime import datetime
from bson import json_util
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', 'default_secret_key')

# ------------------ MongoDB Connection ------------------
client = MongoClient(os.getenv('MONGO_URI', 'mongodb://localhost:27017/'))
db = client['fullstack_ai_lab']
predictions_collection = db['predictions']

# ------------------ Load Models ------------------
with open('iris_logistic_regression.pkl', 'rb') as f:
    logistic_model = pickle.load(f)

# (Using same model as placeholder for Naive Bayes)
naive_bayes_model = logistic_model

with open('feature_names.pkl', 'rb') as f:
    feature_names = pickle.load(f)

with open('target_names.pkl', 'rb') as f:
    target_names = pickle.load(f)

# ------------------ Routes ------------------

@app.route('/')
def home():
    return render_template('dashboard.html')


@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        data = request.get_json()
        features = data.get('features')
        model_name = data.get('model', 'logistic_regression')

        if not features or len(features) != 4:
            return jsonify({'error': 'Expected 4 features'}), 400

        features_array = np.array([features])

        # Select model
        if model_name == 'logistic_regression':
            model = logistic_model
        elif model_name == 'naive_bayes':
            model = naive_bayes_model
        else:
            return jsonify({'error': 'Invalid model name'}), 400

        # Prediction
        prediction = model.predict(features_array)
        prediction_index = int(prediction[0])
        predicted_class = target_names[prediction_index]

        probabilities = model.predict_proba(features_array)[0]
        prob_dict = {
            target_names[i]: float(probabilities[i])
            for i in range(len(target_names))
        }

        record = {
            'timestamp': datetime.utcnow(),
            'model': model_name,
            'features': {
                feature_names[i]: features[i]
                for i in range(len(features))
            },
            'prediction': predicted_class,
            'prediction_index': prediction_index,
            'probabilities': prob_dict,
            'confidence': float(max(probabilities))
        }

        predictions_collection.insert_one(record)

        return jsonify({
            'model_used': model_name,
            'prediction': predicted_class,
            'prediction_index': prediction_index,
            'probabilities': prob_dict,
            'confidence': float(max(probabilities))
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stats', methods=['GET'])
def get_stats():
    try:
        total_predictions = predictions_collection.count_documents({})

        predictions_by_class = list(predictions_collection.aggregate([
            {'$group': {'_id': '$prediction', 'count': {'$sum': 1}}}
        ]))

        predictions_by_model = list(predictions_collection.aggregate([
            {'$group': {'_id': '$model', 'count': {'$sum': 1}}}
        ]))

        avg_confidence_by_model = list(predictions_collection.aggregate([
            {'$group': {'_id': '$model', 'avg_confidence': {'$avg': '$confidence'}}}
        ]))

        recent_predictions = list(
            predictions_collection.find().sort('timestamp', -1).limit(10)
        )

        confidence_distribution = list(predictions_collection.aggregate([
            {
                '$group': {
                    '_id': {
                        '$cond': [
                            {'$gte': ['$confidence', 0.9]}, 'High (>90%)',
                            {
                                '$cond': [
                                    {'$gte': ['$confidence', 0.7]},
                                    'Medium (70-90%)',
                                    'Low (<70%)'
                                ]
                            }
                        ]
                    },
                    'count': {'$sum': 1}
                }
            }
        ]))

        return json.loads(json_util.dumps({
            'total_predictions': total_predictions,
            'predictions_by_class': predictions_by_class,
            'predictions_by_model': predictions_by_model,
            'avg_confidence_by_model': avg_confidence_by_model,
            'recent_predictions': recent_predictions,
            'confidence_distribution': confidence_distribution
        }))

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clear-history', methods=['POST'])
def clear_history():
    try:
        result = predictions_collection.delete_many({})
        return jsonify({
            'success': True,
            'deleted_count': result.deleted_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ------------------ Run App ------------------
if __name__ == "__main__":
    app.run(debug=True)