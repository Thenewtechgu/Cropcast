import {
  FieldProfile,
  WeatherObservation,
  DailyAgronomicBrief,
  RecommendationAction,
  ProvenanceBadge,
  FarmTask,
  FeedbackRecord,
  PlantingRiskEvaluation,
} from '../types';
import type { AppLanguage } from '../contexts/LanguageContext';
import { getPlantDisplayName, getCommonStageLabel, getCommonVarietyLabel } from '../data/cropTaxonomy';

/**
 * Tier 4 Agronomic Engine: Multi-Factor Decision Analysis
 * Combines Soil Physics + Crop Phenology + NASA POWER 21-Yr Baseline +
 * OCO-2 Carbon/SIF + GRACE Groundwater + GHGx/EDGAR + SMAP/MODIS + Farmer Adaptive Memory
 */
export function analyzeFieldAgronomy(
  field: FieldProfile,
  weather: WeatherObservation,
  feedbackHistory: FeedbackRecord[] = [],
  lang: AppLanguage = 'vi'
): DailyAgronomicBrief {
  const isEn = lang === 'en';
  const topActions: RecommendationAction[] = [];
  const postponeActions: string[] = [];
  const provenances: ProvenanceBadge[] = [];
  const earth = field.adaptiveMemory?.earthMetrics;

  // 1. Track multi-source data provenance with explicit "Last updated" timestamps
  provenances.push({
    label: isEn ? 'NASA POWER Historical (2005–2025)' : 'NASA POWER Lịch sử (2005–2025)',
    type: 'NASA_HISTORICAL',
    lastUpdated: '2025-12-31',
    description: isEn
      ? `Cell ${field.nasaGrid.lat}°N, ${field.nasaGrid.lon}°E (${field.nasaGrid.distanceKm} km away). 21-year regional climate baseline.`
      : `Ô ${field.nasaGrid.lat}°N, ${field.nasaGrid.lon}°E (cách ${field.nasaGrid.distanceKm} km). Chuỗi 21 năm đối chiếu khí hậu vùng.`,
  });

  if (weather.isRealtimeAvailable) {
    provenances.push({
      label:
        weather.source === 'NASA_POWER_UPDATED'
          ? isEn
            ? 'NASA POWER Daily Weather'
            : 'NASA POWER Cập nhật'
          : isEn
          ? 'Local Station / Field Observation'
          : 'Dữ liệu Quan trắc Trạm/Địa phương',
      type: 'NASA_CURRENT',
      lastUpdated: earth?.nasaPowerLastUpdated || weather.observationDate,
      description: isEn
        ? `Observed ${weather.observationDate}: ${weather.temp}°C, rain ${weather.rain}mm, humidity ${weather.humidity}%.`
        : `Ghi nhận ngày ${weather.observationDate}: ${weather.temp}°C, mưa ${weather.rain}mm, ẩm ${weather.humidity}%.`,
    });
  } else {
    provenances.push({
      label: isEn ? 'User Field Observation' : 'Dữ liệu Quan sát Người dùng cung cấp',
      type: 'USER_OBSERVATION',
      lastUpdated: weather.observationDate,
      description: isEn
        ? 'No automated local station; using farmer profile & 21-year climate baseline.'
        : 'Chưa có trạm đo tự động trực tiếp, AI sử dụng thông số nông dân nhập và khí hậu lịch sử.',
    });
  }

  if (earth) {
    provenances.push({
      label: 'NASA OCO-2/3 (Carbon & SIF)',
      type: 'NASA_CURRENT',
      lastUpdated: earth.carbonFluxOco2.lastUpdated || earth.syncedAt,
      description: isEn
        ? `Photosynthesis SIF ${earth.carbonFluxOco2.sifWm2SrUm}, carbon uptake ${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha, XCO₂ ${earth.carbonFluxOco2.xco2Ppm} ppm.`
        : `Quang hợp SIF ${earth.carbonFluxOco2.sifWm2SrUm}, hấp thụ ${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha, XCO₂ ${earth.carbonFluxOco2.xco2Ppm} ppm.`,
    });

    provenances.push({
      label: 'NASA GRACE / GRACE-FO',
      type: 'NASA_CURRENT',
      lastUpdated: earth.groundwaterAnomalyGrace.lastUpdated || earth.syncedAt,
      description: isEn
        ? `Groundwater storage ${earth.groundwaterAnomalyGrace.lweThicknessCm >= 0 ? '+' : ''}${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE (${earth.groundwaterAnomalyGrace.groundwaterStatus}).`
        : `Trữ lượng nước ngầm ${earth.groundwaterAnomalyGrace.lweThicknessCm >= 0 ? '+' : ''}${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE (${earth.groundwaterAnomalyGrace.groundwaterStatus === 'recharging' ? 'phục hồi' : earth.groundwaterAnomalyGrace.groundwaterStatus === 'depleting' ? 'suy giảm' : 'ổn định'}).`,
    });

    provenances.push({
      label: 'GHGx / EDGAR Agricultural Inventory',
      type: 'EXTERNAL_FORECAST',
      lastUpdated: earth.greenhouseGasEdgar.lastUpdated || earth.syncedAt,
      description: isEn
        ? `CH₄ ${earth.greenhouseGasEdgar.ch4KgHa} kg/ha, N₂O ${earth.greenhouseGasEdgar.n2oKgHa} kg/ha (${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha).`
        : `CH₄ ${earth.greenhouseGasEdgar.ch4KgHa} kg/ha, N₂O ${earth.greenhouseGasEdgar.n2oKgHa} kg/ha (${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha).`,
    });

    if (earth.smapModis) {
      provenances.push({
        label: 'NASA SMAP / MODIS / GPM',
        type: 'NASA_CURRENT',
        lastUpdated: earth.smapModis.lastUpdated || earth.syncedAt,
        description: isEn
          ? `SMAP surface moisture ${earth.smapModis.smapSoilMoisturePct}%, MODIS NDVI ${earth.smapModis.modisNdvi}, 7d GPM rain ${earth.smapModis.gpmPrecipitation7dMm} mm.`
          : `Ẩm tầng mặt SMAP ${earth.smapModis.smapSoilMoisturePct}%, MODIS NDVI ${earth.smapModis.modisNdvi}, mưa 7 ngày GPM ${earth.smapModis.gpmPrecipitation7dMm} mm.`,
      });
    }
  }

  provenances.push({
    label: isEn ? 'Personalized Field Profile' : 'Hồ sơ Thửa ruộng Cá nhân hóa',
    type: 'USER_OBSERVATION',
    lastUpdated: field.adaptiveMemory?.lastFeedbackDate || field.crop.plantingDate,
    description: isEn
      ? `Soil: ${getSoilLabel(field.soilType, lang)}, Drainage: ${getDrainageLabel(field.soilCharacteristics.drainage, lang)}, Crop: ${getPlantDisplayName(field.crop.name, lang)} (${getCommonStageLabel(field.crop.currentStage, lang)}).`
      : `Đất: ${getSoilLabel(field.soilType, lang)}, Thoát nước: ${getDrainageLabel(field.soilCharacteristics.drainage, lang)}, Cây: ${field.crop.name} (${field.crop.variety}), Giai đoạn: ${field.crop.currentStage}.`,
  });

  // Check learned farmer feedback
  let adjustedDrainage = field.soilCharacteristics.drainage;
  const recentDryFeedbacks = feedbackHistory.filter((f) => f.feedbackType === 'soil_still_dry').length;
  const recentWetFeedbacks = feedbackHistory.filter((f) => f.feedbackType === 'soil_too_wet').length;

  if (recentDryFeedbacks >= 2 && adjustedDrainage !== 'fast') adjustedDrainage = 'fast';
  else if (recentWetFeedbacks >= 2 && adjustedDrainage !== 'slow') adjustedDrainage = 'slow';

  // Effective root moisture blended with GRACE / SMAP if synced
  const graceDepleting = earth?.groundwaterAnomalyGrace?.groundwaterStatus === 'depleting';
  const graceRecharging = earth?.groundwaterAnomalyGrace?.groundwaterStatus === 'recharging';
  const oco2LowPhotosynthesis = earth?.carbonFluxOco2?.photosynthesisStatus === 'low';
  const ghgHigh = earth?.greenhouseGasEdgar?.emissionLevel === 'high';
  const smapMoistPct = earth?.smapModis?.smapSoilMoisturePct;

  const isLowMoisture =
    (weather.gwetroot < 0.35 && weather.rain < 2) ||
    (graceDepleting && weather.gwetroot < 0.48 && weather.rain < 3);
  const isColdWet = weather.temp < 20 && (weather.rain > 0 || weather.humidity > 85);
  const isExtremeHeat = weather.maxTemp >= 35 || (weather.temp >= 33 && weather.solarRadiation > 22);

  const isFlowering =
    field.crop.currentStage.toLowerCase().includes('hoa') ||
    field.crop.currentStage.toLowerCase().includes('trổ') ||
    field.crop.currentStage.toLowerCase().includes('đòng') ||
    field.crop.currentStage.toLowerCase().includes('flower');

  let riskLevel: DailyAgronomicBrief['riskLevel'] = 'LOW';
  const cropDisplay = getPlantDisplayName(field.crop.name, lang);
  const stageDisplay = getCommonStageLabel(field.crop.currentStage, lang);
  const varietyDisplay = getCommonVarietyLabel(field.crop.variety, lang);
  let headline = isEn
    ? `STABLE: Favorable conditions for ${cropDisplay}`
    : `ỔN ĐỊNH: Điều kiện thuận lợi cho ${field.crop.name}`;
  let situation = isEn
    ? `Temperature ${weather.temp}°C, rainfall ${weather.rain}mm. Field "${field.name}" remains in stable condition.`
    : `Nhiệt độ ${weather.temp}°C, lượng mưa ${weather.rain}mm. Điều kiện ruộng ${field.name} duy trì trạng thái tốt.`;
  let analysis = isEn
    ? `Root-zone moisture is ${(weather.gwetroot * 100).toFixed(0)}%${smapMoistPct !== undefined ? ` (SMAP surface: ${smapMoistPct}%)` : ''}. ${getSoilLabel(field.soilType, lang)} maintains suitable water retention for ${stageDisplay}.`
    : `Độ ẩm rễ đạt ${(weather.gwetroot * 100).toFixed(0)}%${smapMoistPct !== undefined ? ` (SMAP tầng mặt: ${smapMoistPct}%)` : ''}. ${getSoilLabel(field.soilType, lang)} đang giữ độ ẩm phù hợp với nhu cầu sinh trưởng giai đoạn ${field.crop.currentStage}.`;

  if (isColdWet) {
    riskLevel = 'WARNING';
    headline = isEn
      ? `WARNING: Cold & damp conditions require monitoring`
      : `CẢNH BÁO: Điều kiện lạnh ẩm cần theo dõi`;
    situation = isEn
      ? `Low temperature (${weather.temp}°C), high air humidity (${weather.humidity}%) and light rain/wet surface.`
      : `Nhiệt độ hạ thấp (${weather.temp}°C), độ ẩm không khí cao (${weather.humidity}%) và có mưa phùn/ẩm ướt.`;

    const isSlowSoil =
      adjustedDrainage === 'slow' ||
      ['clay', 'clay_loam', 'acid_sulfate', 'peat_muck'].includes(field.soilType);
    if (isSlowSoil) {
      analysis = isEn
        ? `${field.name} has slow-draining ${getSoilLabel(field.soilType, lang)} during ${stageDisplay}. Standing moisture below 20°C restricts root oxygen and increases fungal pressure.`
        : `Thửa ruộng ${field.name} có kết cấu ${getSoilLabel(field.soilType, lang).toLowerCase()} thoát nước chậm, kết hợp giai đoạn ${field.crop.currentStage}. Nước đọng lâu ngày dưới 20°C cản trở hô hấp rễ và kích hoạt nấm hại.`;
      topActions.push({
        id: 'act-drain',
        title: isEn ? 'Clear edge drainage furrows immediately' : 'Khơi thông rãnh thoát nước ngay đầu bờ',
        priority: 'HIGH',
        reason: isEn
          ? `Slow drainage increases root suffocation risk in cold, damp weather`
          : `${getSoilLabel(field.soilType, lang)} thoát nước chậm, nguy cơ bí khí nghẹt rễ khi lạnh ẩm kéo dài`,
        dataBasis: `Temp ${weather.temp}°C · Root ${(weather.gwetroot * 100).toFixed(0)}%`,
      });
      topActions.push({
        id: 'act-leaf-check',
        title: isEn ? 'Scout undersides of leaves for fungal spots' : 'Quan sát mặt dưới lá và gốc để phát hiện đốm nấm ẩm',
        priority: 'MEDIUM',
        reason: isEn ? 'Humidity >85% creates prolonged leaf wetness' : 'Ẩm độ không khí >85% tạo màng ẩm thuận lợi cho nấm bệnh phát triển',
        dataBasis: `RH ${weather.humidity}% · Rain ${weather.rain}mm`,
      });
      postponeActions.push(
        isEn
          ? 'Postpone irrigation because soil is saturated and cold.'
          : 'Tạm hoãn tưới nước vì đất đang giữ ẩm bão hòa, tưới thêm sẽ gây ngạt rễ.'
      );
      postponeActions.push(
        isEn
          ? 'Delay Urea/Nitrogen top-dressing to avoid leaching, N₂O emissions, and soft fungal-prone leaves.'
          : 'Hoãn bón phân đạm (Urê) vì cây hấp thu kém khi lạnh ẩm, dễ rửa trôi thành khí N₂O và bùng phát bệnh nấm.'
      );
    } else {
      analysis = isEn
        ? `${getSoilLabel(field.soilType, lang)} drains relatively well (${getDrainageLabel(adjustedDrainage, lang)}), reducing standing water risk, though cold night temperatures still stress young roots.`
        : `${getSoilLabel(field.soilType, lang)} có độ thấm nước tương đối tốt (${getDrainageLabel(adjustedDrainage, lang)}), nguy cơ đọng nước thấp hơn đất sét nhưng cây ${field.crop.name} non vẫn nhạy cảm với sốc lạnh.`;
      topActions.push({
        id: 'act-check-sand-moist',
        title: isEn ? 'Verify moisture at 10cm root depth before watering' : 'Kiểm tra độ ẩm thực tế tại tầng rễ',
        priority: 'HIGH',
        reason: isEn ? 'Well-drained soil loses surface water quickly despite drizzle' : 'Đất rút nước nhanh, không mặc định mưa phùn đã ngấm đủ sâu đến rễ',
        dataBasis: `GWETROOT ${(weather.gwetroot * 100).toFixed(0)}%`,
      });
      topActions.push({
        id: 'act-warm-mulch',
        title: isEn ? 'Apply dry straw mulch around plant bases' : 'Cân nhắc tủ gốc bằng rơm rạ khô giữ ấm rễ',
        priority: 'MEDIUM',
        reason: isEn ? 'Insulates root zone during cold nights' : 'Giữ nhiệt độ đất vùng rễ ổn định khi nhiệt độ ban đêm hạ sâu',
        dataBasis: `Min temp ${weather.minTemp}°C`,
      });
      postponeActions.push(
        isEn
          ? 'Avoid fast-release synthetic fertilizer during cold rain.'
          : 'Tạm hoãn bón phân vô cơ tan nhanh trong những ngày mưa rét.'
      );
    }
  } else if (isExtremeHeat || (isLowMoisture && weather.temp > 26)) {
    riskLevel = isExtremeHeat && graceDepleting ? 'CRITICAL' : 'WARNING';
    headline = isEn
      ? `WARNING: High evapotranspiration & moisture deficit risk`
      : `CẢNH BÁO: Nguy cơ bốc thoát hơi nước cao & thiếu ẩm cục bộ`;
    situation = isEn
      ? `Peak temperature ${weather.maxTemp}°C, solar radiation ${weather.solarRadiation} MJ/m²${graceDepleting ? `, GRACE groundwater ${earth?.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE (depleting)` : ''}.`
      : `Nhiệt độ lên tới ${weather.maxTemp}°C, bức xạ mặt trời ${weather.solarRadiation} MJ/m²${graceDepleting ? `, nước ngầm GRACE ở mức ${earth?.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE (đang suy giảm)` : ''}.`;

    const isFastSoil =
      ['sand', 'sandy_loam', 'gravelly', 'gray_degraded'].includes(field.soilType) ||
      adjustedDrainage === 'fast';
    analysis = isEn
      ? `${isFastSoil ? 'Fast-draining' : 'Moderate/slow'} ${getSoilLabel(field.soilType, lang)} faces rapid evaporation under high solar load. ${graceDepleting ? 'GRACE groundwater reserves are negative — avoid deep well over-pumping and use precision morning watering.' : 'Check 10–15cm root moisture before watering.'}`
      : `${getSoilLabel(field.soilType, lang)} ${isFastSoil ? 'thấm rút nhanh khiến tầng mặt khô nhanh trong ngày nắng gắt.' : 'có thể nứt bề mặt nhưng tầng rễ giữ ẩm khá hơn; cần kiểm tra sâu 10–15cm.'} ${graceDepleting ? 'Dữ liệu GRACE cho thấy mực nước ngầm đang suy giảm, nên chuyển sang tưới nhỏ giọt / tiết kiệm buổi sáng sớm.' : ''}`;

    topActions.push({
      id: 'act-irrigate-early',
      title: isEn ? 'Water lightly early morning (05:30–07:00)' : 'Tưới nước bổ sung vào sáng sớm (05:30 - 07:00)',
      priority: 'HIGH',
      reason: isEn
        ? 'Minimizes evaporation loss and supports canopy cooling before midday heat'
        : 'Giảm thất thoát bốc hơi, giúp cây tích nước trước khi nắng gắt',
      dataBasis: `Solar ${weather.solarRadiation} MJ/m² · GWETTOP ${(weather.gwettop * 100).toFixed(0)}%`,
    });
    topActions.push({
      id: 'act-mulch-sand',
      title: isEn ? 'Apply organic straw mulch to cut evaporation' : 'Tủ ẩm gốc hoặc phủ rơm rạ giữ nước quanh luống',
      priority: 'HIGH',
      reason: isEn ? 'Reduces soil moisture evaporation up to 35–40%' : 'Hạn chế bốc hơi nước mặt đất, tiết kiệm nước tưới',
      dataBasis: graceDepleting ? `GRACE ${earth?.groundwaterAnomalyGrace?.lweThicknessCm} cm LWE` : getGoalLabel(field.primaryGoal, lang),
    });
    postponeActions.push(
      isEn
        ? 'Avoid overhead irrigation during peak midday heat (11:00–14:00).'
        : 'Tạm hoãn tưới phun mưa vào buổi trưa nắng gắt (11:00 - 14:00) tránh sốc nhiệt và cháy lá.'
    );
  } else if (isFlowering) {
    riskLevel = 'CAUTION';
    headline = isEn
      ? `CAUTION: Sensitive flowering/heading stage (${stageDisplay})`
      : `CHÚ Ý: Giai đoạn nhạy cảm ${field.crop.currentStage}`;
    situation = isEn
      ? 'Crop is in pollination/grain-filling phase; stable root moisture is essential.'
      : 'Cây đang trong thời kỳ thụ phấn / làm hạt. Cần đặc biệt chú trọng duy trì mực nước và vi khí hậu ruộng.';
    analysis = isEn
      ? `Sudden water stress now sharply cuts pollination rate. Maintain root moisture at 55–70% (${(weather.gwetroot * 100).toFixed(0)}% currently).`
      : `Bất kỳ sự thiếu hụt ẩm hay mưa giông bất chợt nào trong giai đoạn này đều có thể giảm tỷ lệ đậu hạt/quả. Độ ẩm rễ hiện tại ${(weather.gwetroot * 100).toFixed(0)}%.`;

    topActions.push({
      id: 'act-maintain-moist',
      title: isEn ? 'Maintain steady 60–70% root-zone moisture' : 'Duy trì độ ẩm đất ổn định 60 - 70%',
      priority: 'HIGH',
      reason: isEn ? 'Flowering is highly sensitive to both drought and waterlogging' : 'Giai đoạn trổ/hoa cực kỳ nhạy cảm với sốc nước (cả úng lẫn hạn)',
      dataBasis: `${cropDisplay} (${stageDisplay})`,
    });
    topActions.push({
      id: 'act-pest-scout',
      title: isEn ? 'Scout for hoppers, thrips, and panicle pests' : 'Kiểm tra mật độ sâu/bọ trĩ/rầy phấn trắng',
      priority: 'MEDIUM',
      reason: isEn ? `RH ${weather.humidity}% and ${weather.temp}°C favor pest buildup` : `Độ ẩm ${weather.humidity}% và nhiệt độ ${weather.temp}°C dễ phát sinh sâu chích hút`,
      dataBasis: `RH ${weather.humidity}% · Temp ${weather.temp}°C`,
    });
    postponeActions.push(
      isEn
        ? 'Do not spray emulsifiable pesticides during early-morning pollination.'
        : 'Tuyệt đối tránh phun thuốc trừ sâu vào lúc hoa đang thụ phấn sáng sớm.'
    );
  } else {
    topActions.push({
      id: 'act-field-walk',
      title: isEn
        ? `Routine field inspection (${field.inspectTime === 'afternoon' ? 'afternoon' : 'morning'})`
        : `Thăm đồng định kỳ vào ${field.inspectTime === 'morning' ? 'buổi sáng' : 'buổi chiều'}`,
      priority: 'MEDIUM',
      reason: isEn ? 'Monitor canopy growth, weeds, and basal moisture' : 'Theo dõi sinh trưởng cây và nhổ cỏ dại cạnh tranh dinh dưỡng',
      dataBasis: isEn ? `Schedule: ${field.inspectTime}` : `Lịch người dùng: ${field.inspectTime === 'morning' ? 'Buổi sáng' : 'Buổi chiều'}`,
    });
    topActions.push({
      id: 'act-opt-irrigation',
      title: isEn ? 'Maintain precision water-saving schedule' : 'Duy trì chế độ tưới tiết kiệm theo nhu cầu thực',
      priority: 'MEDIUM',
      reason: isEn
        ? `Root moisture at ${(weather.gwetroot * 100).toFixed(0)}%; avoid over-irrigation`
        : `Độ ẩm rễ đạt ${(weather.gwetroot * 100).toFixed(0)}%, chưa cần tưới ồ ạt`,
      dataBasis: `GWETROOT ${(weather.gwetroot * 100).toFixed(0)}%`,
    });
  }

  // --- ENRICHMENT FROM OCO-2, GRACE & GHGx/EDGAR ---
  if (earth) {
    if (graceDepleting && !topActions.some((a) => a.id === 'act-grace-save')) {
      if (riskLevel === 'LOW') riskLevel = 'CAUTION';
      topActions.push({
        id: 'act-grace-save',
        title: isEn
          ? 'GRACE Groundwater Alert: Switch to precision/AWD watering'
          : 'Cảnh báo GRACE: Chuyển tưới tiết kiệm / ngập–khô xen kẽ',
        priority: 'HIGH',
        reason: isEn
          ? `Satellite groundwater anomaly is ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE (depleting trend). Avoid deep borewell pumping.`
          : `Nước ngầm GRACE xuống mức ${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE (đang suy giảm). Hạn chế bơm giếng sâu và lên kế hoạch luân canh cây chịu hạn.`,
        dataBasis: `GRACE-FO (${earth.groundwaterAnomalyGrace.observationDate})`,
      });
    } else if (graceRecharging) {
      analysis += isEn
        ? ` GRACE-FO groundwater anomaly is positive (+${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE), supporting natural root moisture without heavy pumping.`
        : ` Chỉ số nước ngầm GRACE-FO phục hồi tốt (+${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE), thuận lợi giữ ẩm tự nhiên không cần bơm sâu.`;
    }

    if (oco2LowPhotosynthesis) {
      topActions.push({
        id: 'act-oco2-sif',
        title: isEn
          ? 'Check leaf chlorophyll & canopy vitality (Low OCO-2 SIF)'
          : 'Kiểm tra diệp lục lá & sức khỏe tán (OCO-2 SIF thấp)',
        priority: 'MEDIUM',
        reason: isEn
          ? `OCO-2 solar-induced fluorescence is low (${earth.carbonFluxOco2.sifWm2SrUm}), signaling cloud stress, N deficiency, or early root stress.`
          : `Chỉ số huỳnh quang quang hợp OCO-2 SIF ở mức thấp (${earth.carbonFluxOco2.sifWm2SrUm}), có thể do thiếu nắng, thiếu vi lượng hoặc rễ hấp thu kém.`,
        dataBasis: `NASA OCO-2/3 · Carbon ${earth.carbonFluxOco2.carbonUptakeTonHaYr} t/ha`,
      });
    } else if (earth.carbonFluxOco2.photosynthesisStatus === 'high') {
      analysis += isEn
        ? ` OCO-2 SIF (${earth.carbonFluxOco2.sifWm2SrUm}) shows strong carbon assimilation (${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha).`
        : ` Quang hợp OCO-2 SIF (${earth.carbonFluxOco2.sifWm2SrUm}) đang đạt mức tốt (${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha).`;
    }

    if (ghgHigh) {
      topActions.push({
        id: 'act-ghg-awd',
        title: isEn
          ? 'Cut CH₄/N₂O emissions: Apply AWD drainage & split fertilizer'
          : 'Giảm phát thải CH₄/N₂O: Áp dụng rút nước giữa vụ & chia nhỏ đạm',
        priority: 'MEDIUM',
        reason: isEn
          ? `GHGx/EDGAR estimates ${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha (CH₄ ${earth.greenhouseGasEdgar.ch4KgHa} kg/ha). Brief aerobic drainage cuts methane up to 40%.`
          : `GHGx/EDGAR ghi nhận ${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha (CH₄ ${earth.greenhouseGasEdgar.ch4KgHa} kg/ha). Rút nước xen kẽ (AWD) giúp cắt giảm tới 40% Mê-tan.`,
        dataBasis: `GHGx/EDGAR (${earth.greenhouseGasEdgar.observationDate})`,
      });
      postponeActions.push(
        isEn
          ? 'Avoid single heavy Urea application while continuously flooded (drives N₂O & CH₄ spikes).'
          : 'Tránh bón dồn 1 lần lượng đạm lớn khi ruộng ngập sâu kéo dài (gây thất thoát N₂O và tăng CH₄).'
      );
    }
  }

  let nextCheckTime = isEn ? 'Tomorrow 06:30 AM' : 'Sáng mai lúc 06:30';
  if (riskLevel === 'WARNING' || riskLevel === 'CRITICAL') {
    nextCheckTime =
      field.inspectTime === 'afternoon'
        ? isEn
          ? 'Today 04:30 PM'
          : 'Chiều nay lúc 16:30'
        : isEn
        ? 'Tomorrow 06:00 AM'
        : 'Sáng sớm mai lúc 06:00';
  } else if (field.inspectTime === 'afternoon') {
    nextCheckTime = isEn ? 'Tomorrow 04:30 PM' : 'Chiều mai lúc 16:30';
  }

  const agronomicExplanation = isEn
    ? `Multi-source synthesis:
1. Soil physics: ${getSoilLabel(field.soilType, lang)} (${getDrainageLabel(adjustedDrainage, lang)}).
2. Crop phenology: ${cropDisplay} (${varietyDisplay}) at ${stageDisplay}.
3. NASA POWER 21-yr baseline: Historical avg ${weather.historicalBaseline.avgTemp}°C vs current ${weather.temp}°C.
${earth ? `4. Earth satellites synced: OCO-2 (${earth.carbonFluxOco2.carbonUptakeTonHaYr} t CO₂/ha), GRACE (${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE), GHGx (${earth.greenhouseGasEdgar.co2eqTonHa} t CO₂e/ha).` : '4. Ready for NASA OCO-2/GRACE/GHGx sync on Dashboard.'}
5. Adaptive memory: ${feedbackHistory.length} field feedbacks recorded.`
    : `Khuyến nghị được tổng hợp từ đa nguồn dữ liệu:
1. Kết cấu đất: ${getSoilLabel(field.soilType, lang)} (${getDrainageLabel(adjustedDrainage, lang)}).
2. Sinh lý cây trồng: ${field.crop.name} (${field.crop.variety}) — giai đoạn ${field.crop.currentStage}.
3. Đối chiếu NASA POWER 21 năm (2005–2025): Nhiệt độ nền ${weather.historicalBaseline.avgTemp}°C so với hiện tại ${weather.temp}°C.
${earth ? `4. Vệ tinh môi trường đồng bộ: OCO-2 (${earth.carbonFluxOco2.carbonUptakeTonHaYr} tấn CO₂/ha), GRACE (${earth.groundwaterAnomalyGrace.lweThicknessCm} cm LWE), GHGx (${earth.greenhouseGasEdgar.co2eqTonHa} tấn CO₂e/ha).` : '4. Có thể bấm "Đồng bộ dữ liệu NASA" để bổ sung chỉ số OCO-2, GRACE và GHGx.'}
5. Trí nhớ thích ứng: Đã ghi nhận ${feedbackHistory.length} phản hồi thực địa từ nông hộ.`;

  const uncertainties = isEn
    ? 'Scientific transparency: Satellite grids (POWER 0.5°, GRACE Mascon, OCO-2) reflect regional averages and cannot replace direct hand-checks of soil moisture or underside leaf scouting.'
    : 'Lưu ý minh bạch khoa học: Vệ tinh NASA POWER, GRACE và OCO-2 phản ánh quy mô ô lưới vùng nên không thể thay thế việc kiểm tra ẩm độ tầng rễ bằng tay và soi mặt dưới lá trực tiếp tại ruộng.';

  return {
    id: `BRIEF_${field.id}_${Date.now()}`,
    fieldId: field.id,
    timestamp: new Date().toISOString(),
    headline,
    riskLevel,
    situation,
    analysis,
    topActions: topActions.slice(0, 4),
    postponeActions,
    explanation: agronomicExplanation,
    uncertainties,
    nextCheckTime,
    provenances,
  };
}

export function generateTasksFromBrief(brief: DailyAgronomicBrief, field: FieldProfile): FarmTask[] {
  return brief.topActions.map((act, idx) => ({
    id: `TASK_${brief.id}_${idx}`,
    fieldId: field.id,
    title: act.title,
    scheduledTime: brief.nextCheckTime,
    priority: act.priority,
    reason: act.reason,
    triggerData: act.dataBasis,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }));
}

export function evaluatePlantingCalendar(
  cropName: string,
  _soilType: string,
  gridLat: number,
  lang: AppLanguage = 'vi'
): PlantingRiskEvaluation[] {
  const isEn = lang === 'en';
  const evaluations: PlantingRiskEvaluation[] = [];
  const isNorth = gridLat > 16.5;

  for (let month = 1; month <= 12; month++) {
    let status: PlantingRiskEvaluation['status'] = 'optimal';
    let adverseYears = 2;
    let adverseDaysAvg = 1.5;
    let thresholdCondition = isEn ? 'Stable climate window' : 'Khí hậu tương đối ổn định';
    let explanation = isEn
      ? 'Average temperature and moisture conditions favor planting or harvest.'
      : 'Điều kiện thời tiết trung bình thuận lợi cho gieo trồng hoặc thu hoạch.';

    if (cropName.toLowerCase().includes('lúa') || cropName.toLowerCase().includes('rice')) {
      if (isNorth) {
        if (month === 1) {
          status = 'risk';
          adverseYears = 14;
          adverseDaysAvg = 8.5;
          thresholdCondition = isEn
            ? 'Night temp < 12°C (Severe cold damages seedlings)'
            : 'Nhiệt độ ban đêm xuống dưới 12°C (Rét hại làm chết mạ)';
          explanation = isEn
            ? '14 of 21 years recorded >5 days of severe cold; cover nursery beds with plastic film.'
            : 'Trong 21 năm quan trắc, có 14 năm xuất hiện rét đậm/hại kéo dài trên 5 ngày, nguy cơ chết mạ nếu không che phủ nilon.';
        } else if (month === 2) {
          status = 'caution';
          adverseYears = 8;
          adverseDaysAvg = 4.2;
          thresholdCondition = isEn
            ? 'Mean temp < 15°C with drizzle'
            : 'Nhiệt độ trung bình dưới 15°C kết hợp mưa phùn';
          explanation = isEn
            ? '8 of 21 years had late cold spells slowing rice tillering.'
            : '8 trong 21 năm có đợt rét muộn ảnh hưởng đẻ nhánh.';
        } else if (month >= 3 && month <= 5) {
          status = 'optimal';
          adverseYears = 2;
          adverseDaysAvg = 1.0;
          thresholdCondition = isEn ? '22–29°C with balanced sunshine' : 'Nhiệt độ 22-29°C, ẩm độ và nắng tăng đều';
          explanation = isEn
            ? 'Optimal solar radiation and temperature for vegetative growth and panicle initiation.'
            : 'Giai đoạn ánh sáng và nhiệt độ tối ưu cho lúa sinh trưởng thân lá và làm đòng.';
        } else if (month === 7 || month === 8) {
          status = 'caution';
          adverseYears = 9;
          adverseDaysAvg = 6.0;
          thresholdCondition = isEn ? 'Heavy storm rain > 50mm/day' : 'Mưa lớn trên 50mm/ngày và nguy cơ ngập úng';
          explanation = isEn
            ? 'Peak summer storm season; low fields need drainage pumps ready.'
            : 'Giai đoạn mưa bão cao điểm mùa hè; đất trũng thoát nước chậm cần chuẩn bị máy bơm tiêu úng.';
        }
      } else {
        if (month >= 2 && month <= 4) {
          status = 'caution';
          adverseYears = 11;
          adverseDaysAvg = 18.0;
          thresholdCondition = isEn
            ? 'Dry-season water deficit & salinity intrusion'
            : 'Hạn hán & Xâm nhập mặn nguồn nước';
          explanation = isEn
            ? '11 of 21 years recorded 4g/L salinity intrusion in Mekong canals; test water before pumping.'
            : 'Mùa khô cao điểm ĐBSCL; 11 trong 21 năm có ranh mặn 4g/l lấn sâu vào sông rạch. Cần kiểm tra độ mặn trước khi bơm tưới.';
        } else if (month >= 9 && month <= 11) {
          status = 'caution';
          adverseYears = 7;
          adverseDaysAvg = 5.0;
          thresholdCondition = isEn ? 'Flood & high-tide rain' : 'Mưa dầm kết hợp triều cường';
          explanation = isEn
            ? 'High flood/tide risk; maintain closed dike drainage.'
            : 'Mùa lũ và triều cường cuối năm, cần chủ động đê bao khép kín.';
        } else {
          status = 'optimal';
          adverseYears = 2;
          adverseDaysAvg = 1.2;
          thresholdCondition = isEn ? 'Warm 27–31°C stable window' : 'Nhiệt độ ấm áp 27-31°C quanh năm';
          explanation = isEn
            ? 'Favorable temperature and solar window for high-yield Winter-Spring rice.'
            : 'Điều kiện nhiệt ẩm rất tốt cho lúa vụ Đông Xuân năng suất cao.';
        }
      }
    } else if (
      cropName.toLowerCase().includes('cải') ||
      cropName.toLowerCase().includes('rau') ||
      cropName.toLowerCase().includes('veg') ||
      cropName.toLowerCase().includes('green') ||
      cropName.toLowerCase().includes('cabbage') ||
      cropName.toLowerCase().includes('mustard')
    ) {
      if (isNorth) {
        if (month >= 10 || month <= 2) {
          status = 'optimal';
          adverseYears = 1;
          adverseDaysAvg = 1.0;
          thresholdCondition = isEn ? 'Cool 16–22°C ideal for brassicas' : 'Thời tiết mát mẻ 16-22°C rất thích hợp rau họ Cải';
          explanation = isEn
            ? 'Golden winter window for leafy vegetables.'
            : 'Vụ Đông là mùa vàng của rau cải; năng suất và phẩm chất lá ngon ngọt nhất.';
        } else if (month >= 6 && month <= 8) {
          status = 'risk';
          adverseYears = 17;
          adverseDaysAvg = 12.0;
          thresholdCondition = isEn ? 'Daytime > 36°C & heavy downpours' : 'Nhiệt độ ban ngày vượt 36°C và mưa rào xối xả';
          explanation = isEn
            ? '17 of 21 years had heat stress + soft rot risk.'
            : 'Nắng nóng gay gắt kết hợp mưa dập lá làm bùng phát thối nhũn vi khuẩn; 17 trong 21 năm có đợt sốc nhiệt.';
        } else {
          status = 'caution';
          adverseYears = 5;
          adverseDaysAvg = 3.0;
          thresholdCondition = isEn ? 'High transitional humidity' : 'Giao mùa ẩm độ cao';
          explanation = isEn ? 'Watch for powdery mildew and flea beetles.' : 'Cần chú ý bệnh phấn trắng và bọ nhảy.';
        }
      } else {
        if (month >= 5 && month <= 9) {
          status = 'caution';
          adverseYears = 10;
          adverseDaysAvg = 8.0;
          thresholdCondition = isEn ? 'Heavy tropical rainstorms' : 'Mưa giông nhiệt đới lượng mưa lớn';
          explanation = isEn ? 'Use rain netting and raised beds.' : 'Cần che lưới ngăn hạt mưa xé nát phiến lá và luống thoát nước cao.';
        } else {
          status = 'optimal';
          adverseYears = 3;
          adverseDaysAvg = 2.0;
          thresholdCondition = isEn ? 'Steady sun & moderate humidity' : 'Nắng đều, ẩm độ vừa phải';
          explanation = isEn ? 'Favorable for vegetable rotation.' : 'Thuận lợi cho luân canh rau màu.';
        }
      }
    } else {
      if (month >= 5 && month <= 7) {
        status = 'caution';
        adverseYears = 6;
        adverseDaysAvg = 4.0;
        thresholdCondition = isEn ? 'Heat > 35°C during pollination' : 'Nhiệt độ cao lúc trổ cờ phun râu';
        explanation = isEn
          ? 'Temperatures >35°C during tasseling dry out pollen.'
          : 'Nếu gặp nhiệt độ >35°C lúc tung phấn sẽ làm khô hạt phấn, giảm tỷ lệ đậu bắp.';
      }
    }

    evaluations.push({
      cropName,
      variety: isEn ? 'Regional recommendation' : 'Khuyến nghị vùng',
      month,
      status,
      score: status === 'optimal' ? 90 : status === 'caution' ? 65 : 35,
      yearsSurveyed: 21,
      adverseYearsCount: adverseYears,
      adverseDaysAvg,
      thresholdCondition,
      summaryExplanation: explanation,
    });
  }

  return evaluations;
}

export interface SoilTypeMeta {
  type:
    | 'sand'
    | 'sandy_loam'
    | 'loam'
    | 'sandy_clay_loam'
    | 'clay_loam'
    | 'clay'
    | 'alluvial'
    | 'basalt'
    | 'ferralsol'
    | 'gray_degraded'
    | 'acid_sulfate'
    | 'saline'
    | 'peat_muck'
    | 'limestone'
    | 'gravelly'
    | 'unknown';
  label: string;
  labelEn: string;
  shortHint: string;
  shortHintEn: string;
  defaultDrainage: 'fast' | 'moderate' | 'slow';
  defaultHoldsWater: boolean;
  defaultFlooding: boolean;
}

export const SOIL_TYPE_CATALOG: SoilTypeMeta[] = [
  { type: 'alluvial', label: 'Đất phù sa', labelEn: 'Alluvial Soil', shortHint: 'Màu mỡ ven sông, giữ ẩm khá tốt', shortHintEn: 'Fertile riverside soil, balanced moisture', defaultDrainage: 'moderate', defaultHoldsWater: true, defaultFlooding: false },
  { type: 'loam', label: 'Đất thịt trung bình', labelEn: 'Loam Soil', shortHint: 'Tơi xốp cân bằng, dễ canh tác đa cây', shortHintEn: 'Balanced texture, versatile for most crops', defaultDrainage: 'moderate', defaultHoldsWater: true, defaultFlooding: false },
  { type: 'sandy_loam', label: 'Đất cát pha', labelEn: 'Sandy Loam', shortHint: 'Nhẹ đất, thoát nhanh, hợp lạc/khoai/rau', shortHintEn: 'Light, fast-draining, good for peanut/tubers', defaultDrainage: 'fast', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'sandy_clay_loam', label: 'Đất thịt nhẹ', labelEn: 'Sandy Clay Loam', shortHint: 'Dễ cày bừa, thoát nước vừa phải', shortHintEn: 'Easy tillage, moderate drainage', defaultDrainage: 'moderate', defaultHoldsWater: true, defaultFlooding: false },
  { type: 'clay_loam', label: 'Đất thịt nặng / sét pha', labelEn: 'Clay Loam', shortHint: 'Giữ nước và phân tốt, hơi bí khi mưa', shortHintEn: 'Holds water/nutrients well, slow during heavy rain', defaultDrainage: 'slow', defaultHoldsWater: true, defaultFlooding: true },
  { type: 'clay', label: 'Đất sét', labelEn: 'Clay Soil', shortHint: 'Dẻo dính, giữ nước lâu, dễ ngập úng', shortHintEn: 'Sticky, high water retention, flood-prone', defaultDrainage: 'slow', defaultHoldsWater: true, defaultFlooding: true },
  { type: 'sand', label: 'Đất cát', labelEn: 'Sandy Soil', shortHint: 'Rời rạc, rút nước rất nhanh, mau khô', shortHintEn: 'Drains rapidly, dries out quickly', defaultDrainage: 'fast', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'basalt', label: 'Đất đỏ bazan', labelEn: 'Red Basalt Soil', shortHint: 'Tầng dày, tơi xốp, giàu khoáng Tây Nguyên', shortHintEn: 'Deep porous volcanic soil, nutrient-rich', defaultDrainage: 'moderate', defaultHoldsWater: true, defaultFlooding: false },
  { type: 'ferralsol', label: 'Đất đỏ vàng đồi núi', labelEn: 'Ferralsol', shortHint: 'Đất đồi Feralit, cần giữ mùn chống rửa trôi', shortHintEn: 'Upland soil, needs cover crop to prevent erosion', defaultDrainage: 'fast', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'gray_degraded', label: 'Đất xám bạc màu', labelEn: 'Degraded Gray Soil', shortHint: 'Nghèo mùn, dễ đóng váng mặt, hợp họ Đậu', shortHintEn: 'Low organic matter, benefits from legumes', defaultDrainage: 'fast', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'acid_sulfate', label: 'Đất phèn', labelEn: 'Acid Sulfate Soil', shortHint: 'pH thấp (chua), cần rửa phèn và lên luống', shortHintEn: 'Low pH, requires raised beds and flushing', defaultDrainage: 'slow', defaultHoldsWater: true, defaultFlooding: true },
  { type: 'saline', label: 'Đất mặn / nhiễm mặn', labelEn: 'Saline Soil', shortHint: 'Ven biển / cửa sông, cần theo dõi độ mặn', shortHintEn: 'Coastal salinity risk, monitor EC', defaultDrainage: 'slow', defaultHoldsWater: true, defaultFlooding: false },
  { type: 'peat_muck', label: 'Đất than bùn / trũng mùn', labelEn: 'Peat / Muck Soil', shortHint: 'Giàu hữu cơ vùng trũng, ngập nước theo mùa', shortHintEn: 'Organic wetland, seasonal flooding', defaultDrainage: 'slow', defaultHoldsWater: true, defaultFlooding: true },
  { type: 'limestone', label: 'Đất thung lũng đá vôi', labelEn: 'Limestone Valley Soil', shortHint: 'Độ pH trung tính–kiềm nhẹ, thoát khá nhanh', shortHintEn: 'Neutral-alkaline pH, good drainage', defaultDrainage: 'moderate', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'gravelly', label: 'Đất sỏi đá / tầng mỏng', labelEn: 'Gravelly Shallow Soil', shortHint: 'Đất dốc nhiều sỏi sạn, rất dễ khô hạn', shortHintEn: 'Sloped rocky soil, drought-prone', defaultDrainage: 'fast', defaultHoldsWater: false, defaultFlooding: false },
  { type: 'unknown', label: 'Chưa rõ loại đất', labelEn: 'Unknown Soil Type', shortHint: 'Dùng hướng dẫn nắm đất để nhận diện nhanh', shortHintEn: 'Use feel test to identify texture', defaultDrainage: 'moderate', defaultHoldsWater: true, defaultFlooding: false },
];

export function getSoilLabel(type: string, lang: AppLanguage = 'vi'): string {
  const found = SOIL_TYPE_CATALOG.find((s) => s.type === type);
  if (!found) return type;
  return lang === 'en' ? found.labelEn : found.label;
}

export function getDrainageLabel(drainage: string, lang: AppLanguage = 'vi'): string {
  if (lang === 'en') {
    const enMap: Record<string, string> = {
      fast: 'Fast drainage',
      moderate: 'Moderate drainage',
      slow: 'Slow drainage (waterlog risk)',
    };
    return enMap[drainage] || drainage;
  }
  const map: Record<string, string> = {
    fast: 'Thoát nước nhanh',
    moderate: 'Thoát nước trung bình',
    slow: 'Thoát nước chậm (dễ úng)',
  };
  return map[drainage] || drainage;
}

export function getWaterLabel(type: string, lang: AppLanguage = 'vi'): string {
  if (lang === 'en') {
    const enMap: Record<string, string> = {
      river: 'River water',
      pond: 'Pond / lake',
      well: 'Borewell',
      tap: 'Tap water',
      rain: 'Rainwater',
      other: 'Other source',
    };
    return enMap[type] || type;
  }
  const map: Record<string, string> = {
    river: 'Nước sông',
    pond: 'Nước ao/hồ',
    well: 'Nước giếng khoan',
    tap: 'Nước máy',
    rain: 'Nước mưa',
    other: 'Nguồn khác',
  };
  return map[type] || type;
}

export function getGoalLabel(goal: string, lang: AppLanguage = 'vi'): string {
  if (lang === 'en') {
    const enMap: Record<string, string> = {
      save_water: 'Save irrigation water',
      minimize_risk: 'Minimize weather risks',
      stabilize_yield: 'Stabilize yield',
      optimize_cost: 'Optimize fertilizer/input cost',
    };
    return enMap[goal] || goal;
  }
  const map: Record<string, string> = {
    save_water: 'Tiết kiệm nước tưới',
    minimize_risk: 'Giảm thiểu rủi ro thời tiết',
    stabilize_yield: 'Ổn định năng suất',
    optimize_cost: 'Tối ưu chi phí phân bón/thuốc',
  };
  return map[goal] || goal;
}

export interface FieldCheckInInput {
  predictionOutcome: 'on_track' | 'needs_adjustment' | 'off_track';
  observedMoisture: 'dry' | 'balanced' | 'wet';
  observedCropHealth: 'healthy' | 'stressed' | 'pest_risk';
  updatedStage?: string;
  note?: string;
}

export interface FieldCheckInDiagnostic {
  isPredictionAccurate: boolean;
  verdictTitle: string;
  rootCauseExplanation: string;
  fixes: string[];
  recommendedHealthStatus: 'healthy' | 'stressed' | 'pest_risk';
  soilAdjustmentNote: string;
  irrigationSensitivity: 'higher' | 'normal' | 'lower';
  suggestedTasks: FarmTask[];
}

export function evaluateFieldCheckIn(
  field: FieldProfile,
  weather: WeatherObservation,
  brief: DailyAgronomicBrief,
  input: FieldCheckInInput,
  lang: AppLanguage = 'vi'
): FieldCheckInDiagnostic {
  const isEn = lang === 'en';
  const fixes: string[] = [];
  const cropName = getPlantDisplayName(field.crop.name, lang);
  const soilName = getSoilLabel(field.soilType, lang);
  const rootPct = Math.round(weather.gwetroot * 100);

  let isPredictionAccurate = input.predictionOutcome === 'on_track';
  let verdictTitle = '';
  let rootCauseExplanation = '';
  let recommendedHealthStatus: 'healthy' | 'stressed' | 'pest_risk' = input.observedCropHealth;
  let soilAdjustmentNote = field.adaptiveMemory?.soilAdjustment || '';
  let irrigationSensitivity: 'higher' | 'normal' | 'lower' =
    field.adaptiveMemory?.irrigationSensitivity || 'normal';

  const modelExpectedWet = weather.rain >= 5 || weather.gwetroot >= 0.7;
  const modelExpectedDry = weather.gwetroot < 0.45 && weather.rain < 2;

  if (input.observedMoisture === 'dry') {
    irrigationSensitivity = 'higher';
    soilAdjustmentNote = isEn
      ? 'Farmer check-in confirmed soil dries faster than satellite grid baseline: higher irrigation sensitivity applied.'
      : 'Cập nhật thực địa cho thấy đất khô nhanh hơn dự báo vệ tinh: đã tăng độ nhạy nhắc tưới.';

    if (modelExpectedWet || input.predictionOutcome !== 'on_track') {
      isPredictionAccurate = false;
      rootCauseExplanation = isEn
        ? `NASA POWER (${rootPct}% root moisture, ${weather.rain}mm rain) reflects a wide ~50 km grid average, while your actual topsoil on ${soilName} is losing water faster due to wind exposure, uneven canal seepage, or lighter local texture.`
        : `Ô lưới NASA POWER (ẩm rễ ${rootPct}%, mưa ${weather.rain} mm) phản ánh trung bình vùng rộng ~50 km, trong khi lớp đất thực tế tại ruộng (${soilName}) thoát nước nhanh hơn hoặc chưa thấm đều nước tưới/mưa.`;
    }

    fixes.push(
      isEn
        ? `Irrigate ${Math.round(Math.max(10, field.areaHa * 25))} m³ gently early tomorrow (05:30–07:00) to moisten the 10–15 cm root zone without runoff.`
        : `Tưới bổ sung nhẹ vào sáng sớm mai (05:30–07:00) để thấm sâu 10–15 cm vùng rễ cho diện tích ${field.areaHa} ha.`
    );
    fixes.push(
      isEn
        ? 'Spread straw, dry grass, or rice husk mulch around plant bases to cut surface evaporation by 30–40%.'
        : 'Tủ gốc bằng rơm rạ hoặc cỏ khô quanh luống để giảm 30–40% tốc độ bốc hơi nước tầng mặt.'
    );
    fixes.push(
      isEn
        ? 'Check field bunds/pipes for hidden leaks or soil crusting; break compacted topsoil lightly before watering.'
        : 'Kiểm tra bờ ruộng/ống dẫn tránh rò rỉ thất thoát nước và xới phá váng nhẹ nếu đất đóng váng.'
    );
  } else if (input.observedMoisture === 'wet') {
    irrigationSensitivity = 'lower';
    soilAdjustmentNote = isEn
      ? 'Farmer check-in confirmed slow drainage / pooling: irrigation postponed & drainage prioritized.'
      : 'Cập nhật thực địa cho thấy đất giữ ẩm lâu / thoát nước chậm: hoãn tưới và ưu tiên tiêu thoát nước.';

    if (modelExpectedDry || input.predictionOutcome !== 'on_track') {
      isPredictionAccurate = false;
      rootCauseExplanation = isEn
        ? `Even though regional evaporation looked moderate (${rootPct}% model root moisture), low-lying micro-topography or compacted ${soilName} subsoil is trapping excess water.`
        : `Dù mô hình khí hậu vùng cho thấy ẩm độ trung bình (${rootPct}%), địa hình trũng cục bộ hoặc tầng đế cày của ${soilName} đang giữ nước lâu gây nguy cơ nghẹt rễ.`;
    }

    fixes.push(
      isEn
        ? 'Pause all scheduled irrigation for at least 48–72 hours until hand-squeeze topsoil no longer drips water.'
        : 'Ngừng tưới hoàn toàn ít nhất 48–72 giờ cho đến khi nắm đất kiểm tra không còn rỉ nước.'
    );
    fixes.push(
      isEn
        ? 'Clear outlet ditches and cut shallow cross-furrows at low corners to drain standing water within 12 hours.'
        : 'Khơi thông rãnh đầu bờ và xẻ rãnh xương cá ở góc trũng để rút hết nước đọng trong 12 giờ.'
    );
    fixes.push(
      isEn
        ? 'Hold back Urea / Nitrogen top-dressing until soil drains so roots recover oxygen and avoid N₂O leaching.'
        : 'Tạm hoãn bón thúc đạm (Urê) để tránh thối rễ, rửa trôi phân và phát sinh nấm bệnh.'
    );
  } else {
    soilAdjustmentNote =
      input.predictionOutcome === 'on_track'
        ? isEn
          ? `Validated soil moisture calibration on ${new Date().toISOString().slice(0, 10)}: predictions match field reality.`
          : `Đã đối chiếu thực địa ngày ${new Date().toISOString().slice(0, 10)}: dự báo độ ẩm đang khớp tốt với ruộng.`
        : soilAdjustmentNote;
  }

  if (input.observedCropHealth === 'stressed') {
    isPredictionAccurate = false;
    fixes.push(
      isEn
        ? `Dig 1–2 weak ${cropName} plants gently to inspect white feeder roots vs brown/rotted roots, and check leaf yellowing pattern (lower leaves = Nitrogen/wetness; young tips = Calcium/Boron or heat).`
        : `Kiểm tra nhẹ vùng rễ tơ của cây ${cropName} bị yếu (rễ trắng khỏe hay đen thối) và vị trí vàng lá (lá già = thiếu đạm/úng; đọt non = sốc nhiệt hoặc thiếu vi lượng).`
    );
    fixes.push(
      isEn
        ? 'Avoid heavy chemical spraying during midday stress; apply mild organic foliar amino/seaweed or balanced NPK once moisture stabilizes.'
        : 'Không phun phân/thuốc nồng độ cao lúc cây đang sốc; chỉ bổ sung dinh dưỡng nhẹ vào chiều mát sau khi đã chỉnh ẩm độ đất.'
    );
  } else if (input.observedCropHealth === 'pest_risk') {
    isPredictionAccurate = false;
    fixes.push(
      isEn
        ? `Scout 5 sample points across ${field.name} (focusing on undersides of leaves and stem bases) to confirm pest/fungal density before targeted biological or IPM treatment.`
        : `Kiểm tra 5 điểm chéo góc trên ruộng ${field.name} (mặt dưới lá và gốc thân) để xác định đúng đối tượng sâu/nấm trước khi xử lý theo ngưỡng phòng trừ tổng hợp (IPM).`
    );
    fixes.push(
      isEn
        ? 'Remove severely infected leaves/shoots away from field bunds and widen row ventilation by trimming weeds on borders.'
        : 'Ngắt bỏ lá/cành bệnh nặng ra khỏi bờ ruộng và phát quang cỏ bờ để giảm ẩm độ lưu không khí.'
    );
  }

  if (input.predictionOutcome !== 'on_track' && fixes.length === 0) {
    rootCauseExplanation = isEn
      ? `You reported the plan is off track (${brief.headline}). Re-syncing field soil/crop stage assumptions ensures upcoming advisories adapt.`
      : `Bạn báo cáo thực tế chưa khớp hoàn toàn kế hoạch (${brief.headline}). Hệ thống đã ghi nhận sai lệch để điều chỉnh các khuyến nghị tiếp theo.`;
    fixes.push(
      isEn
        ? 'Verify your field crop growth stage and soil drainage setting in My Fields → Edit if the crop grew faster/slower than planted.'
        : 'Kiểm tra lại giai đoạn sinh trưởng và tốc độ thoát nước trong mục Ruộng của tôi → Chỉnh sửa để lịch chăm sóc bám sát thực tế.'
    );
    fixes.push(
      isEn
        ? 'Review Today’s Recommended Actions on the Dashboard and postpone high-risk tasks until weather and moisture match.'
        : 'Rà soát lại danh sách Việc nên làm hôm nay và tạm hoãn các bước nhạy cảm cho đến khi ẩm độ đất ổn định.'
    );
  }

  if (!rootCauseExplanation) {
    rootCauseExplanation = isPredictionAccurate
      ? isEn
        ? `Your field conditions align closely with CropCast's NASA climate baseline (${weather.temp}°C, ${rootPct}% root moisture) and ${soilName} model.`
        : `Tình trạng thực tế tại ruộng đang bám sát dự báo khí hậu NASA (${weather.temp}°C, ẩm rễ ${rootPct}%) và mô hình đất (${soilName}).`
      : isEn
      ? 'Micro-climate variations or localized crop stress shifted your field off the baseline projection. Follow the corrective steps below to restore the plan.'
      : 'Biến động vi khí hậu cục bộ hoặc áp lực sinh trưởng thực tế khiến ruộng lệch khỏi dự báo nền. Làm theo các bước khắc phục bên dưới để đưa ruộng về đúng kế hoạch.';
  }

  if (fixes.length === 0) {
    fixes.push(
      isEn
        ? `Keep current ${field.crop.irrigationMethod} schedule and inspect again at ${brief.nextCheckTime}.`
        : `Tiếp tục duy trì chế độ ${field.crop.irrigationMethod} hiện tại và kiểm tra lại vào ${brief.nextCheckTime}.`
    );
    fixes.push(
      isEn
        ? 'Log another quick update in 3–5 days or right after the next heavy rain to keep predictions calibrated.'
        : 'Ghi nhận cập nhật tiếp theo sau 3–5 ngày hoặc ngay sau đợt mưa lớn để giữ độ chính xác dự báo.'
    );
  }

  if (isPredictionAccurate) {
    verdictTitle = isEn
      ? 'Prediction is working as planned — Field is on track'
      : 'Dự báo đang khớp thực tế — Ruộng đi đúng kế hoạch';
  } else if (input.predictionOutcome === 'off_track' || input.observedCropHealth !== 'healthy') {
    verdictTitle = isEn
      ? 'Action needed: Field diverged from forecast — Fixes ready'
      : 'Cần điều chỉnh ngay: Thực tế lệch dự báo — Có phương án khắc phục';
  } else {
    verdictTitle = isEn
      ? 'Minor calibration applied — Follow adjustments to stay on plan'
      : 'Đã hiệu chỉnh dự báo theo thực địa — Làm theo các bước để giữ đúng tiến độ';
  }

  const nowIso = new Date().toISOString();
  const suggestedTasks: FarmTask[] = isPredictionAccurate
    ? []
    : fixes.slice(0, 3).map((fixText, idx) => ({
        id: `FIX_${field.id}_${Date.now()}_${idx}`,
        fieldId: field.id,
        title: fixText.slice(0, 180),
        scheduledTime: isEn ? 'Within 24 hours' : 'Trong 24 giờ tới',
        priority: idx === 0 ? 'HIGH' : 'MEDIUM',
        reason: isEn
          ? `Corrective step from field update (${input.observedMoisture} soil · ${input.observedCropHealth} crop)`
          : `Khắc phục sai lệch thực địa (đất: ${input.observedMoisture} · cây: ${input.observedCropHealth})`,
        triggerData: `${weather.temp}°C · Root ${rootPct}%`,
        status: 'pending',
        createdAt: nowIso,
      }));

  return {
    isPredictionAccurate,
    verdictTitle,
    rootCauseExplanation,
    fixes,
    recommendedHealthStatus,
    soilAdjustmentNote,
    irrigationSensitivity,
    suggestedTasks,
  };
}
