import axios from 'axios';
import { MongoClient } from 'mongodb';
import { translate } from '@vitalets/google-translate-api';

const apiUrl = 'https://exercisedb.p.rapidapi.com/exercises';
const apiKey = '1676c855b0msh3cafd9565eb9b03p19bbb5jsnbdc2f5c8909a';

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'exercisedb';
const collectionName = 'exercises_pt';

async function translateExercise(exercise: any) {
  try {
    const [name, target, equipment, instructions] = await Promise.all([
      translate(exercise.name, { to: 'pt' }).then(res => res.text),
      translate(exercise.target, { to: 'pt' }).then(res => res.text),
      translate(exercise.equipment, { to: 'pt' }).then(res => res.text),
      Promise.all(exercise.instructions.map((inst: string) => translate(inst, { to: 'pt' }).then(res => res.text)))
    ]);

    return {
      ...exercise,
      name,
      target,
      equipment,
      instructions,
    };
  } catch (error) {
    console.error(`Erro ao traduzir o exercício ${exercise.name}:`, error);
    return exercise;
  }
}

async function fetchAndStoreExercises() {
  const client = new MongoClient(mongoUrl);

  try {
    console.log('Conectando ao MongoDB...');
    await client.connect();
    console.log('Conectado ao MongoDB com sucesso.');

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    let hasMore = true;
    let offset = 0;
    const limit = 50;
    let totalFetched = 0;

    console.log('Buscando dados da API em lotes...');
    while (hasMore && totalFetched < 550) {
      const response = await axios.get(apiUrl, {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
        },
        params: {
          limit: limit,
          offset: offset
        }
      });

      const exercises = response.data;
      if (exercises.length > 0) {
        console.log(`Traduzindo ${exercises.length} exercícios...`);
        const translatedExercises = await Promise.all(exercises.map(translateExercise));
        await collection.insertMany(translatedExercises);
        totalFetched += exercises.length;
        console.log(`${exercises.length} exercícios traduzidos e inseridos. Total: ${totalFetched}`);
        offset += limit;

        console.log('Aguardando 2 segundos antes da próxima requisição...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        hasMore = false;
      }
    }

    console.log(`Busca finalizada. Total de ${totalFetched} exercícios inseridos.`);

  } catch (error) {
    console.error('Ocorreu um erro:', error);
  } finally {
    await client.close();
    console.log('Conexão com o MongoDB fechada.');
  }
}

fetchAndStoreExercises();

