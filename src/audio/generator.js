/**
 * Audio Generator
 * 
 * Converts text scripts to audio using ElevenLabs Text-to-Speech.
 * This is optional - the system works fine with just script generation.
 */

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import config from '../config/config.js';
import logger from '../utils/logger.js';
import { getVoiceConfig } from './voice-config.js';

const log = logger.child('AudioGenerator');

export class AudioGenerator {
  constructor() {
    this.apiKey = config.elevenLabsApiKey;
  }

  /**
   * Check if audio generation is available
   * 
   * @returns {boolean} True if ElevenLabs key is configured
   */
  isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Generate audio from script
   * 
   * @param {string} script - Podcast script
   * @param {string} setting - Podcast setting
   * @param {string} outputPath - Output file path
   * @returns {Promise<Object>} Generation result
   */
  async generate(script, setting, outputPath) {
    if (!this.isAvailable()) {
      throw new Error('ElevenLabs API key not configured. Set ELEVENLABS_API_KEY in .env');
    }

    const startTime = Date.now();
    log.start('Generating audio', {
      setting,
      scriptLength: script.length,
      outputPath,
    });

    try {
      // Get voice configuration
      const voiceConfig = getVoiceConfig(setting);

      // Split script into chunks if needed (ElevenLabs has character limits)
      const chunks = this.splitScript(script, 2800);
      log.info(`Script split into ${chunks.length} chunk(s)`);

      // Generate audio for each chunk
      const audioBuffers = [];
      for (let i = 0; i < chunks.length; i++) {
        log.info(`Generating chunk ${i + 1}/${chunks.length}`);
        const buffer = await this.generateChunk(chunks[i], voiceConfig);
        audioBuffers.push(buffer);
      }

      // Concatenate audio buffers
      const finalAudio = Buffer.concat(audioBuffers);

      // Ensure output directory exists
      await fs.mkdir(path.dirname(outputPath), { recursive: true });

      // Write to file
      await fs.writeFile(outputPath, finalAudio);

      const duration = Date.now() - startTime;
      const fileSizeMB = (finalAudio.length / (1024 * 1024)).toFixed(2);

      log.success('Audio generation complete', {
        duration: `${duration}ms`,
        fileSize: `${fileSizeMB} MB`,
        chunks: chunks.length,
        outputPath,
      });

      return {
        outputPath,
        fileSizeMB: parseFloat(fileSizeMB),
        chunks: chunks.length,
        duration,
        voiceId: voiceConfig.voiceId,
      };
    } catch (error) {
      log.error('Audio generation failed', error);
      throw error;
    }
  }

  /**
   * Process script for ElevenLabs v3 audio tags
   * 
   * @param {string} script - Raw script text
   * @returns {string} Processed script with v3 audio tags
   */
  processScriptForV3(script) {
    // v3 natively supports audio tags in square brackets: [whispers], [laughs], [sarcastic], etc.
    // The script generator already creates these correctly, so we mainly preserve them
    let cleanScript = script
      // Convert some legacy patterns to v3 format, but preserve most existing tags
      .replace(/\[speaks (confidently|excitedly|sadly|angrily|calmly|nervously)\]/gi, '[$1]')
      .replace(/\[tone: (sarcastic|curious|excited|frustrated|happy|sad)\]/gi, '[$1]') 
      .replace(/\[voice: (whispers)\]/gi, '[whispers]')
      .replace(/\[voice: (shouts)\]/gi, '[loudly]')  // v3 doesn't have [shouts]
      .replace(/\[pause\]/gi, '...')         // Convert pauses to ellipses
      .replace(/\[beat\]/gi, '.')            // Convert beats to periods
      // Remove complex directions that don't map to v3 audio tags
      .replace(/\[voice: .*?\]/gi, '')
      .replace(/\[direction: .*?\]/gi, '')
      .replace(/\[stage: .*?\]/gi, '')
      // Keep all other square bracket tags - they're likely valid v3 audio tags
      // Clean up formatting only
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleanScript;
  }

  /**
   * Generate audio for a single chunk
   * 
   * @param {string} text - Text chunk
   * @param {Object} voiceConfig - Voice configuration
   * @returns {Promise<Buffer>} Audio buffer
   */
  async generateChunk(text, voiceConfig) {
    // Process script for ElevenLabs v3 audio tags
    const processedText = this.processScriptForV3(text);
    
    log.debug('Processing audio chunk', {
      originalLength: text.length,
      processedLength: processedText.length,
      preview: processedText.substring(0, 200) + '...'
    });
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceConfig.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: processedText,
          model_id: 'eleven_v3', // Most emotionally rich model for expression support
          voice_settings: voiceConfig.settings,
          output_format: 'mp3_22050_32', // Standard MP3 format
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Split script into chunks under character limit
   * 
   * @param {string} script - Full script
   * @param {number} maxLength - Maximum chunk length
   * @returns {Array<string>} Script chunks
   */
  splitScript(script, maxLength) {
    if (script.length <= maxLength) {
      return [script];
    }

    const chunks = [];
    const paragraphs = script.split(/\n\s*\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if ((currentChunk + '\n\n' + paragraph).length <= maxLength) {
        currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // If single paragraph is too long, split by sentences
        if (paragraph.length > maxLength) {
          const sentences = paragraph.split(/(?<=[.!?])\s+/);
          let sentenceChunk = '';
          
          for (const sentence of sentences) {
            if ((sentenceChunk + ' ' + sentence).length <= maxLength) {
              sentenceChunk = sentenceChunk ? sentenceChunk + ' ' + sentence : sentence;
            } else {
              if (sentenceChunk) {
                chunks.push(sentenceChunk);
              }
              sentenceChunk = sentence;
            }
          }
          
          currentChunk = sentenceChunk;
        } else {
          currentChunk = paragraph;
        }
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }
}

/**
 * Generate audio from script
 * 
 * @param {string} script - Podcast script
 * @param {string} setting - Podcast setting
 * @param {string} outputPath - Output file path
 * @returns {Promise<Object>} Generation result
 */
export async function generateAudio(script, setting, outputPath) {
  const generator = new AudioGenerator();
  return await generator.generate(script, setting, outputPath);
}

export default {
  AudioGenerator,
  generateAudio,
};

