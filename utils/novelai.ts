import axios, { AxiosResponse } from 'axios';
import JSZip from 'jszip';
import { NovelAIGenerateRequest, GenerationParams, CharacterConfig } from '../types/novelai';

const NOVELAI_BASE_URL = 'https://image.novelai.net';

export class NovelAIAPI {
  private isV4Model(model: string): boolean {
    return model.includes('nai-diffusion-4');
  }

  // シード値生成の上限を拡大（32bit符号付き整数から64bit相当に）
  private generateRandomSeed(): number {
    // NovelAIでは実際にはシード値の上限がないため、より大きな値を生成
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  public createGenerationRequest(params: GenerationParams, apiKey: string): NovelAIGenerateRequest {
    const baseCaption = params.prompt.trim();
    const negativeCaption = params.negativePrompt.trim();
    const isV4 = this.isV4Model(params.model);

    let modelName = params.model;
    if (params.model === 'custom' && params.customModel) {
      modelName = params.customModel.trim();
    }

    const baseRequest: NovelAIGenerateRequest = {
      input: baseCaption,
      model: modelName,
      action: 'generate',
      parameters: {
        width: params.width,
        height: params.height,
        scale: params.scale,
        sampler: params.sampler,
        steps: params.steps,
        seed: params.seed || this.generateRandomSeed(),
        n_samples: 1,
        ucPreset: 0,
        qualityToggle: false,
        sm: false,
        sm_dyn: false,
        dynamic_thresholding: false,
        controlnet_strength: 1,
        legacy: false,
        add_original_image: false,
        cfg_rescale: params.cfgRescale,
        noise_schedule: 'karras',
        legacy_v3_extend: false,
        reference_information_extracted_multiple: [],
        reference_strength_multiple: [],
        uncond_scale: 0,
        skip_cfg_above_sigma: null,
        skip_cfg_below_sigma: 0,
        lora_unet_weights: null,
        lora_clip_weights: null,
        deliberate_euler_ancestral_bug: false,
        prefer_brownian: true,
        cfg_sched_eligibility: 'enable_for_post_summer_samplers',
        explike_fine_detail: false,
        minimize_sigma_inf: false,
        uncond_per_vibe: true,
        wonky_vibe_correlation: true,
      },
    };

    if (isV4) {
      const charCaptions = params.characters.length > 0 
        ? params.characters.map(char => ({
            char_caption: char.caption,
            centers: [{ x: char.x, y: char.y }]
          }))
        : [];

      const negativeCharCaptions = params.characters.length > 0
        ? params.characters.map(char => ({
            char_caption: char.negativeCaption || "",
            centers: [{ x: char.x, y: char.y }]
          }))
        : [];

      // use_coordsを手動制御可能にする
      const useCoords = params.useCoords !== undefined 
        ? params.useCoords 
        : (params.characters.length > 0);

      baseRequest.parameters.v4_prompt = {
        caption: {
          base_caption: baseCaption,
          char_captions: charCaptions
        },
        use_coords: useCoords,
        use_order: true,
        legacy_uc: false
      };

      baseRequest.parameters.v4_negative_prompt = {
        caption: {
          base_caption: negativeCaption,
          char_captions: negativeCharCaptions
        },
        use_coords: useCoords,
        use_order: false,
        legacy_uc: false
      };
    }

    return baseRequest;
  }

  public async generateImage(params: GenerationParams, apiKey: string): Promise<Blob> {
    if (!apiKey) {
      throw new Error('NovelAI APIキーが設定されていません。');
    }

    try {
      const request = this.createGenerationRequest(params, apiKey);
      
      console.log('NovelAI API Request for papirusu343:', JSON.stringify(request, null, 2));

      const response: AxiosResponse<ArrayBuffer> = await axios.post(
        `${NOVELAI_BASE_URL}/ai/generate-image`,
        request,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          responseType: 'arraybuffer',
          timeout: 180000,
          validateStatus: function (status) {
            return status >= 200 && status < 300;
          }
        }
      );

      console.log('NovelAI API Response Status for papirusu343:', response.status);
      console.log('NovelAI API Response Headers:', response.headers);

      return new Blob([response.data], { type: 'application/zip' });
    } catch (error: any) {
      console.error('NovelAI API Error Details for papirusu343:', error);
      
      let errorMessage = 'NovelAI API エラーが発生しました。';
      let errorDetails = '';

      if (error.response) {
        const status = error.response.status;
        const statusText = error.response.statusText;
        
        errorMessage = `HTTP ${status}: ${statusText}`;
        
        if (error.response.data) {
          try {
            let errorData;
            if (error.response.data instanceof ArrayBuffer) {
              errorData = new TextDecoder().decode(error.response.data);
            } else {
              errorData = error.response.data;
            }
            
            try {
              const parsedError = JSON.parse(errorData);
              if (parsedError.message) {
                errorDetails = parsedError.message;
              } else if (parsedError.error) {
                errorDetails = parsedError.error;
              } else {
                errorDetails = JSON.stringify(parsedError, null, 2);
              }
            } catch {
              errorDetails = errorData.toString();
            }
          } catch (parseError) {
            errorDetails = 'レスポンスの解析に失敗しました';
          }
        }

        switch (status) {
          case 400:
            errorMessage += '\n\n🔧 考えられる原因:';
            errorMessage += '\n• パラメーターが無効です';
            errorMessage += '\n• プロンプトが長すぎる可能性があります';
            errorMessage += '\n• 画像サイズが対応範囲外です';
            errorMessage += '\n• モデル名が正しくありません';
            break;
          case 401:
            errorMessage += '\n\n🔑 認証エラー:';
            errorMessage += '\n• APIキーが無効または期限切れです';
            errorMessage += '\n• APIキーの形式が正しくありません';
            break;
          case 402:
            errorMessage += '\n\n💰 残高不足:';
            errorMessage += '\n• Anlasが不足しています';
            errorMessage += '\n• アカウントの使用制限に達しました';
            break;
          case 403:
            errorMessage += '\n\n🚫 アクセス拒否:';
            errorMessage += '\n• このAPIキーでは使用できない機能です';
            errorMessage += '\n• アカウントが一時停止されている可能性があります';
            break;
          case 429:
            errorMessage += '\n\n⏰ レート制限:';
            errorMessage += '\n• リクエスト制限に達しました';
            errorMessage += '\n• 1〜2分待ってから再試行してください';
            break;
          case 500:
          case 502:
          case 503:
            errorMessage += '\n\n🔧 サーバーエラー:';
            errorMessage += '\n• NovelAIサーバーに問題が発生しています';
            errorMessage += '\n• しばらく待ってから再試行してください';
            break;
        }

        if (errorDetails) {
          errorMessage += '\n\n📝 詳細情報:\n' + errorDetails;
        }

      } else if (error.request) {
        errorMessage = '⚠️ ネットワークエラー';
        errorMessage += '\n\n🔧 考えられる原因:';
        errorMessage += '\n• インターネット接続を確認してください';
        errorMessage += '\n• NovelAIサーバーが一時的に利用できません';
        errorMessage += '\n• ファイアウォールがアクセスをブロックしています';
        errorMessage += '\n• プロキシ設定に問題があります';
      } else {
        errorMessage = `⚠️ 予期しないエラー: ${error.message}`;
      }

      const finalError = new Error(errorMessage);
      finalError.name = 'NovelAIError';
      throw finalError;
    }
  }

  public async extractImageFromZip(zipBlob: Blob): Promise<{ imageBlob: Blob; filename: string }> {
    try {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(zipBlob);
      
      const imageFiles = Object.keys(zipContent.files).filter(filename => 
        filename.toLowerCase().match(/\.(png|jpg|jpeg|webp)$/i) && !zipContent.files[filename].dir
      );

      if (imageFiles.length === 0) {
        throw new Error('📁 ZIPファイル内に画像が見つかりません\n\n🔧 考えられる原因:\n• 生成に失敗した可能性があります\n• サーバーから無効なレスポンスが返されました');
      }

      const imageFile = zipContent.files[imageFiles[0]];
      const imageArrayBuffer = await imageFile.async('arraybuffer');
      const imageBlob = new Blob([imageArrayBuffer], { type: 'image/png' });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `novelai_papirusu343_${timestamp}.png`;

      return {
        imageBlob,
        filename
      };
    } catch (error: any) {
      console.error('ZIP extraction error for papirusu343:', error);
      
      let errorMessage = '📁 ZIP展開エラー';
      errorMessage += '\n\n🔧 考えられる原因:';
      errorMessage += '\n• ダウンロードしたファイルが破損しています';
      errorMessage += '\n• ZIPファイルの形式が無効です';
      errorMessage += '\n• ファイルが完全にダウンロードされていません';
      
      if (error.message) {
        errorMessage += '\n\n📝 詳細: ' + error.message;
      }

      throw new Error(errorMessage);
    }
  }

  public async extractMetadataFromImage(imageBlob: Blob): Promise<any> {
    try {
      return null;
    } catch (error: any) {
      console.error('Metadata extraction error for papirusu343:', error);
      return null;
    }
  }
}

// 正しいエクスポート名に修正
export const novelAIAPI = new NovelAIAPI();