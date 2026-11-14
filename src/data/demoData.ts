import {
  CommunityPost,
  FarmTask,
  FeedbackRecord,
  FieldProfile,
  PlotPlanRecord,
} from '../types';

export interface DemoWorkspaceState {
  fields: FieldProfile[];
  tasks: FarmTask[];
  feedbacks: FeedbackRecord[];
  plans: Record<string, PlotPlanRecord>;
  updatedAt: string;
}

const DEMO_WORKSPACE_KEY = 'cropcast_demo_workspace_v1';
const DEMO_FORUM_KEY = 'cropcast_demo_forum_posts_v1';

export function createDefaultDemoWorkspace(): DemoWorkspaceState {
  const now = new Date();
  const isoToday = now.toISOString().slice(0, 10);
  const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const threeDaysAgoIso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const demoFields: FieldProfile[] = [
    {
      id: 'DEMO_FIELD_ST25_CANTHO',
      ownerId: 'DEMO_FARMER',
      ownerName: 'Nông hộ Demo (Chế độ Trải nghiệm)',
      name: 'Ruộng Lúa ST25 Ô Môn',
      province: 'Cần Thơ',
      district: 'Quận Ô Môn',
      lat: 10.1235,
      lon: 105.6295,
      areaHa: 1.8,
      soilType: 'alluvial',
      soilCharacteristics: {
        drainage: 'moderate',
        holdsWater: true,
        proneToFlooding: false,
        ph: 5.8,
      },
      waterSource: {
        type: 'river',
        isStable: true,
        observation: 'clear',
        hasTestResult: true,
        salinityRisk: false,
        notes: 'Kênh thủy lợi nội đồng Ô Môn',
      },
      crop: {
        seedFamily: 'poaceae',
        name: 'Lúa nước',
        category: 'rice',
        variety: 'ST25',
        plantingDate: '2026-01-18',
        currentStage: 'Đang sinh trưởng / Đẻ nhánh rộ',
        stageIndex: 2,
        farmingMethod: '1 Phải 5 Giảm · Rút nước xen kẽ (AWD)',
        irrigationMethod: 'Tưới ngập khô xen kẽ',
        healthStatus: 'healthy',
      },
      primaryGoal: 'stabilize_yield',
      inspectTime: 'morning',
      notificationMethod: 'in_app',
      nasaGrid: {
        cellId: 'VN_CT_01',
        lat: 10.05,
        lon: 105.75,
        distanceKm: 15.2,
      },
      adaptiveMemory: {
        soilAdjustment: 'Đất phù sa giữ ẩm tốt, phù hợp rút nước xen kẽ giữa vụ giảm phát thải CH₄.',
        irrigationSensitivity: 'normal',
        lastFeedbackDate: isoToday,
        lastPredictionOutcome: 'on_track',
        lastCheckInSummary: 'Mực nước ruộng đạt chuẩn AWD (-5 cm dưới mặt ruộng), cây ST25 đẻ nhánh khỏe.',
        planFixRecommendations: [
          'Giữ mực nước mặt ruộng cạn tự nhiên 4–5 ngày để rễ lúa ST25 ăn sâu, cứng cây.',
          'Chia nhỏ đợt bón thúc đạm kết hợp theo dõi màu lá trước khi đón đòng.',
        ],
        earthMetrics: {
          fieldId: 'DEMO_FIELD_ST25_CANTHO',
          syncedAt: now.toISOString(),
          sustainabilityScore: 86,
          rotationAdvice: 'Sau vụ lúa ST25, khuyến nghị xen 1 vụ Đậu tương hoặc Đậu xanh 65 ngày để cố định đạm tự nhiên.',
          rotationAdviceEn: 'After ST25 rice, rotate with a 65-day soybean or mungbean crop to restore natural nitrogen.',
          nasaPowerLastUpdated: isoToday,
          smapModis: {
            observationDate: isoToday,
            lastUpdated: now.toISOString(),
            smapSoilMoisturePct: 64,
            modisNdvi: 0.76,
            gpmPrecipitation7dMm: 18.4,
            dataSource: 'NASA SMAP L3 / MODIS NDVI / GPM IMERG',
          },
          carbonFluxOco2: {
            fieldId: 'DEMO_FIELD_ST25_CANTHO',
            lat: 10.1235,
            lon: 105.6295,
            observationDate: isoToday,
            lastUpdated: now.toISOString(),
            sifWm2SrUm: 1.48,
            xco2Ppm: 421.2,
            carbonUptakeTonHaYr: 8.6,
            photosynthesisStatus: 'high',
            dataSource: 'NASA OCO-2/3 SIF',
            trendSeries: [
              { label: 'T-4', value: 1.24 },
              { label: 'T-3', value: 1.32 },
              { label: 'T-2', value: 1.41 },
              { label: 'T-1', value: 1.45 },
              { label: 'Nay', value: 1.48 },
            ],
          },
          groundwaterAnomalyGrace: {
            fieldId: 'DEMO_FIELD_ST25_CANTHO',
            lat: 10.1235,
            lon: 105.6295,
            observationDate: isoToday,
            lastUpdated: now.toISOString(),
            lweThicknessCm: 2.1,
            groundwaterStatus: 'stable',
            soilWaterBalancePct: 68,
            dataSource: 'NASA GRACE-FO',
            trendSeries: [
              { label: 'T-4', value: 1.1 },
              { label: 'T-3', value: 1.5 },
              { label: 'T-2', value: 1.9 },
              { label: 'T-1', value: 2.0 },
              { label: 'Nay', value: 2.1 },
            ],
          },
          greenhouseGasEdgar: {
            fieldId: 'DEMO_FIELD_ST25_CANTHO',
            lat: 10.1235,
            lon: 105.6295,
            observationDate: isoToday,
            lastUpdated: now.toISOString(),
            ch4KgHa: 84,
            n2oKgHa: 1.9,
            co2eqTonHa: 2.8,
            emissionLevel: 'moderate',
            cropContext: 'Lúa nước AWD (ST25)',
            dataSource: 'NASA GHG Center / EDGAR v8',
            trendSeries: [
              { label: '2022', value: 3.9 },
              { label: '2023', value: 3.5 },
              { label: '2024', value: 3.1 },
              { label: '2025', value: 2.9 },
              { label: '2026', value: 2.8 },
            ],
          },
        },
      },
    },
    {
      id: 'DEMO_FIELD_LAC_L14_NGHEAN',
      ownerId: 'DEMO_FARMER',
      ownerName: 'Nông hộ Demo (Chế độ Trải nghiệm)',
      name: 'Ruộng Lạc L14 Diễn Châu',
      province: 'Nghệ An',
      district: 'Huyện Diễn Châu',
      lat: 18.976,
      lon: 105.596,
      areaHa: 0.75,
      soilType: 'sandy_loam',
      soilCharacteristics: {
        drainage: 'fast',
        holdsWater: false,
        proneToFlooding: false,
        ph: 6.1,
      },
      waterSource: {
        type: 'well',
        isStable: true,
        observation: 'clear',
        hasTestResult: false,
        salinityRisk: false,
      },
      crop: {
        seedFamily: 'fabaceae',
        name: 'Lạc (Đậu phộng)',
        category: 'legume',
        variety: 'Lạc L14',
        plantingDate: '2026-02-10',
        currentStage: 'Ra hoa / Đâm tia củ',
        stageIndex: 3,
        farmingMethod: 'Lên luống phủ màng nông nghiệp',
        irrigationMethod: 'Tưới rãnh / Phun mưa nhẹ',
        healthStatus: 'healthy',
      },
      primaryGoal: 'save_water',
      inspectTime: 'morning',
      notificationMethod: 'in_app',
      nasaGrid: {
        cellId: 'VN_NA_01',
        lat: 18.8,
        lon: 105.6,
        distanceKm: 19.6,
      },
      adaptiveMemory: {
        soilAdjustment: 'Đất cát pha thoát nước nhanh: ưu tiên tưới nhẹ sáng sớm giai đoạn đâm tia củ.',
        irrigationSensitivity: 'higher',
        lastFeedbackDate: isoToday,
        lastPredictionOutcome: 'on_track',
      },
    },
    {
      id: 'DEMO_FIELD_TOMATO_HANOI',
      ownerId: 'DEMO_FARMER',
      ownerName: 'Nông hộ Demo (Chế độ Trải nghiệm)',
      name: 'Vườn Cà chua Sông Hồng',
      province: 'Hà Nội',
      district: 'Huyện Mê Linh',
      lat: 21.1815,
      lon: 105.7136,
      areaHa: 0.45,
      soilType: 'loam',
      soilCharacteristics: {
        drainage: 'moderate',
        holdsWater: true,
        proneToFlooding: false,
        ph: 6.4,
      },
      waterSource: {
        type: 'pond',
        isStable: true,
        observation: 'normal',
        hasTestResult: true,
        salinityRisk: false,
      },
      crop: {
        seedFamily: 'solanaceae',
        name: 'Cà chua',
        category: 'vegetable',
        variety: 'F1 Savior',
        plantingDate: '2026-01-25',
        currentStage: 'Ra hoa / Kết trái',
        stageIndex: 3,
        farmingMethod: 'Tiêu chuẩn an toàn VietGAP',
        irrigationMethod: 'Tưới nhỏ giọt theo gốc',
        healthStatus: 'healthy',
      },
      primaryGoal: 'minimize_risk',
      inspectTime: 'afternoon',
      notificationMethod: 'in_app',
      nasaGrid: {
        cellId: 'VN_HN_01',
        lat: 21.05,
        lon: 105.85,
        distanceKm: 20.3,
      },
    },
  ];

  const demoTasks: FarmTask[] = [
    {
      id: 'DEMO_TASK_1',
      fieldId: 'DEMO_FIELD_ST25_CANTHO',
      title: 'Kiểm tra mực nước ống AWD trước khi bón thúc đợt 2 cho Lúa ST25',
      titleEn: 'Check AWD water tube before second top-dressing for ST25 rice',
      scheduledTime: 'Sáng mai lúc 06:30',
      scheduledTimeEn: 'Tomorrow 06:30 AM',
      priority: 'HIGH',
      reason: 'Giữ ruộng khô mặt 3–4 ngày giúp rễ khỏe, hạn chế đổ ngã và giảm tới 40% khí Mê-tan.',
      reasonEn: '3–4 days of shallow aeration strengthen roots, reduce lodging, and cut methane up to 40%.',
      triggerData: 'Ẩm tầng rễ 68% · Ẩm tầng mặt 64%',
      triggerDataEn: 'Root-zone moisture 68% · Topsoil moisture 64%',
      status: 'pending',
      createdAt: yesterdayIso,
    },
    {
      id: 'DEMO_TASK_2',
      fieldId: 'DEMO_FIELD_LAC_L14_NGHEAN',
      title: 'Tưới rãnh nhẹ buổi sáng giúp Lạc L14 đâm tia và phát triển củ đều',
      titleEn: 'Apply light morning furrow irrigation for L14 peanut pegging',
      scheduledTime: 'Sáng mai lúc 06:00',
      scheduledTimeEn: 'Tomorrow 06:00 AM',
      priority: 'HIGH',
      reason: 'Đất cát pha thoát nước nhanh vào giai đoạn ra hoa/đâm tia cần đủ ẩm lớp mặt 0–10 cm.',
      reasonEn: 'Fast-draining sandy loam needs steady 0–10 cm moisture during peanut pegging.',
      triggerData: 'Đất cát pha · Thoát nước nhanh',
      triggerDataEn: 'Sandy loam · Fast drainage',
      status: 'pending',
      createdAt: yesterdayIso,
    },
    {
      id: 'DEMO_TASK_3',
      fieldId: 'DEMO_FIELD_TOMATO_HANOI',
      title: 'Kiểm tra mặt dưới lá cà chua phòng bệnh sương mai khi ẩm đêm cao',
      titleEn: 'Scout undersides of tomato leaves for blight during humid nights',
      scheduledTime: 'Chiều nay lúc 16:30',
      scheduledTimeEn: 'Today 04:30 PM',
      priority: 'MEDIUM',
      reason: 'Độ ẩm không khí ban đêm cao dễ đọng sương trên tán lá họ Cà.',
      reasonEn: 'High overnight humidity increases leaf wetness on Solanaceae crops.',
      triggerData: 'Cà chua F1 Savior · Ra hoa / Kết trái',
      triggerDataEn: 'Tomato F1 Savior · Flowering / Fruiting',
      status: 'completed',
      createdAt: threeDaysAgoIso,
    },
  ];

  const demoFeedbacks: FeedbackRecord[] = [
    {
      id: 'DEMO_FB_1',
      fieldId: 'DEMO_FIELD_ST25_CANTHO',
      timestamp: yesterdayIso,
      feedbackType: 'helpful',
      predictionOutcome: 'on_track',
      observedMoisture: 'balanced',
      observedCropHealth: 'healthy',
      userComment: 'Ruộng ST25 rút nước mặt đúng lịch AWD, bộ rễ trắng phát triển mạnh.',
      systemActionTaken: 'Dự báo đang khớp thực tế — Ruộng đi đúng kế hoạch',
      recommendedFixes: [
        'Tiếp tục duy trì chế độ Tưới ngập khô xen kẽ hiện tại và kiểm tra lại sau 3 ngày.',
      ],
      appliedToProfile: true,
    },
    {
      id: 'DEMO_FB_2',
      fieldId: 'DEMO_FIELD_LAC_L14_NGHEAN',
      timestamp: threeDaysAgoIso,
      feedbackType: 'soil_still_dry',
      predictionOutcome: 'needs_adjustment',
      observedMoisture: 'dry',
      observedCropHealth: 'healthy',
      userComment: 'Đất cát pha Diễn Châu gặp gió Lào nhẹ nên mặt luống khô nhanh hơn dự báo.',
      systemActionTaken: 'Đã hiệu chỉnh tăng độ nhạy nhắc tưới cho đất cát pha',
      recommendedFixes: [
        'Tưới bổ sung nhẹ vào sáng sớm (05:30–07:00) để thấm sâu vùng tia củ.',
        'Kiểm tra độ che phủ màng / rơm rạ giữa hai hàng lạc để giữ ẩm.',
      ],
      appliedToProfile: true,
    },
  ];

  const demoPlans: Record<string, PlotPlanRecord> = {
    DEMO_FIELD_ST25_CANTHO: {
      id: 'DEMO_FIELD_ST25_CANTHO',
      ownerId: 'DEMO_FARMER',
      plotId: 'DEMO_FIELD_ST25_CANTHO',
      priorities: ['water_saving', 'nitrogen_fixing', 'pest_break', 'organic_matter'],
      constraints: {
        waterAvailability: 'seasonal_limited',
        equipmentAccess: 'mechanized',
        marketPreference: 'cash_crop',
      },
      rejectedIds: [],
      rejectedTitles: [],
      calendarCropKey: 'Lúa ST25',
      updatedAt: now.toISOString(),
    },
    DEMO_FIELD_LAC_L14_NGHEAN: {
      id: 'DEMO_FIELD_LAC_L14_NGHEAN',
      ownerId: 'DEMO_FARMER',
      plotId: 'DEMO_FIELD_LAC_L14_NGHEAN',
      priorities: ['water_saving', 'erosion_control', 'pest_break'],
      constraints: {
        waterAvailability: 'scarce',
        equipmentAccess: 'basic_manual',
        marketPreference: 'cash_crop',
      },
      rejectedIds: [],
      rejectedTitles: [],
      calendarCropKey: 'Lạc L14',
      updatedAt: now.toISOString(),
    },
  };

  return {
    fields: demoFields,
    tasks: demoTasks,
    feedbacks: demoFeedbacks,
    plans: demoPlans,
    updatedAt: now.toISOString(),
  };
}

export function createSeedCommunityPosts(): CommunityPost[] {
  const now = Date.now();
  return [
    {
      id: 'SEED_POST_CANTHO_1',
      authorUid: 'SEED_USER_1',
      authorName: 'Chú Ba Hùng · HTX Ô Môn',
      province: 'Cần Thơ',
      district: 'Quận Ô Môn',
      cropName: 'Lúa ST25',
      category: 'rotation_tips',
      title: 'Kinh nghiệm rút nước AWD giữa vụ cho Lúa ST25 giảm đổ ngã vụ Đông Xuân',
      content:
        'Bà con Ô Môn năm nay áp dụng rút nước mặt ruộng 4 ngày trước khi đón đòng thấy thân lúa ST25 cứng hẳn, rễ ăn sâu mà tiết kiệm gần 30% công bơm tưới.',
      likesCount: 24,
      upvotedUids: [],
      replies: [
        {
          id: 'SEED_REP_1',
          authorUid: 'SEED_USER_2',
          authorName: 'Anh Minh · Thốt Nốt',
          authorProvince: 'Cần Thơ',
          content:
            'Ruộng mình đất phù sa cũng làm vậy, chú ý chỉ để nứt chân chim nhẹ chứ đừng để khô quá lâu giai đoạn làm đòng nha bà con.',
          createdAt: new Date(now - 2 * 3600 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(now - 5 * 3600 * 1000).toISOString(),
      isDemoSeed: true,
    },
    {
      id: 'SEED_POST_NGHEAN_1',
      authorUid: 'SEED_USER_3',
      authorName: 'Chị Lan · HTX Diễn Thịnh',
      province: 'Nghệ An',
      district: 'Huyện Diễn Châu',
      cropName: 'Lạc L14',
      category: 'soil_water',
      title: 'Mẹo giữ ẩm đất cát pha cho Lạc L14 giai đoạn đâm tia củ',
      content:
        'Khu vực ven biển Diễn Châu nắng gió rất mau khô tầng mặt 0–5 cm. Nhà mình kết hợp tưới rãnh lúc 6h sáng và kiểm tra độ ẩm tầng mặt trước khi vun gốc thấy tỷ lệ củ chắc tăng rõ.',
      likesCount: 19,
      upvotedUids: [],
      replies: [
        {
          id: 'SEED_REP_2',
          authorUid: 'SEED_USER_4',
          authorName: 'Bác Tuấn · Quỳnh Lưu',
          authorProvince: 'Nghệ An',
          content:
            'Xong vụ Lạc L14 tháng 6 này bà con nhớ luân canh qua Ngô hoặc Vừng để tránh bệnh héo xanh vi khuẩn tích tụ trong đất nhé.',
          createdAt: new Date(now - 8 * 3600 * 1000).toISOString(),
        },
      ],
      createdAt: new Date(now - 14 * 3600 * 1000).toISOString(),
      isDemoSeed: true,
    },
    {
      id: 'SEED_POST_HANOI_1',
      authorUid: 'SEED_USER_5',
      authorName: 'Anh Hoàng · Hợp tác xã Mê Linh',
      province: 'Hà Nội',
      district: 'Huyện Mê Linh',
      cropName: 'Cà chua F1',
      category: 'pest_disease',
      title: 'Cảnh báo sương đêm dày và sương mai trên cà chua vùng bãi sông Hồng',
      content:
        'Mấy hôm nay điểm sương ban đêm lên cao, sáng sớm lá ướt đẫm. Bà con Mê Linh nhớ tỉa bớt lá già sát gốc cho thoáng gió và tránh tưới phun mưa buổi chiều tối.',
      likesCount: 31,
      upvotedUids: [],
      replies: [],
      createdAt: new Date(now - 20 * 3600 * 1000).toISOString(),
      isDemoSeed: true,
    },
    {
      id: 'SEED_POST_LAMDONG_1',
      authorUid: 'SEED_USER_6',
      authorName: 'Cô Thu · Đơn Dương',
      province: 'Lâm Đồng',
      district: 'Huyện Đơn Dương',
      cropName: 'Bắp cải / Đậu cô ve',
      category: 'rotation_tips',
      title: 'Luân canh Bắp cải – Đậu cô ve giúp giảm rõ rệt sưng rễ họ Cải tại Đơn Dương',
      content:
        'Sau 2 lứa rau họ Cải mình chuyển sang 1 vụ Đậu leo vừa có thu nhập vừa cải tạo đất tơi xốp, sang vụ sau trồng lại cải rất ít bệnh.',
      likesCount: 28,
      upvotedUids: [],
      replies: [],
      createdAt: new Date(now - 36 * 3600 * 1000).toISOString(),
      isDemoSeed: true,
    },
    {
      id: 'SEED_POST_DAKLAK_1',
      authorUid: 'SEED_USER_7',
      authorName: 'A Yến · Cư M’gar',
      province: 'Đắk Lắk',
      district: 'Huyện Cư M’gar',
      cropName: 'Cà phê / Đậu xanh xen canh',
      category: 'weather_alert',
      title: 'Theo dõi độ ẩm tầng rễ đất đỏ bazan cuối mùa khô Tây Nguyên',
      content:
        'Kiểm tra biểu đồ 25 năm thấy mùa khô Tây Nguyên năm nay nắng gắt hơn trung bình, bà con nhớ giữ thảm cỏ phủ gốc để hạn chế bốc hơi nước tầng mặt.',
      likesCount: 22,
      upvotedUids: [],
      replies: [],
      createdAt: new Date(now - 48 * 3600 * 1000).toISOString(),
      isDemoSeed: true,
    },
  ];
}

export function loadDemoWorkspace(): DemoWorkspaceState {
  try {
    const raw = localStorage.getItem(DEMO_WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoWorkspaceState;
      if (parsed && Array.isArray(parsed.fields)) {
        return parsed;
      }
    }
  } catch {
    // ignore corrupted storage
  }
  const initial = createDefaultDemoWorkspace();
  saveDemoWorkspace(initial);
  return initial;
}

export function saveDemoWorkspace(state: DemoWorkspaceState): void {
  try {
    localStorage.setItem(
      DEMO_WORKSPACE_KEY,
      JSON.stringify({
        ...state,
        updatedAt: new Date().toISOString(),
      })
    );
  } catch {
    // ignore storage limits
  }
}

export function resetDemoWorkspace(): DemoWorkspaceState {
  const fresh = createDefaultDemoWorkspace();
  saveDemoWorkspace(fresh);
  return fresh;
}

export function loadDemoForumPosts(): CommunityPost[] {
  try {
    const raw = localStorage.getItem(DEMO_FORUM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CommunityPost[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const seeded = createSeedCommunityPosts();
  saveDemoForumPosts(seeded);
  return seeded;
}

export function saveDemoForumPosts(posts: CommunityPost[]): void {
  try {
    localStorage.setItem(DEMO_FORUM_KEY, JSON.stringify(posts));
  } catch {
    // ignore
  }
}
