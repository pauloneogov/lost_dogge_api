// @ts-nocheck
import { prisma } from "../prisma";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../main";
const bizSdk = require("facebook-nodejs-business-sdk");
const { SimpleIntervalJob, AsyncTask } = require("toad-scheduler");
const AdAccount = bizSdk.AdAccount;
const Ad = bizSdk.Ad;

export function fbAdRoutes(fastify: FastifyInstance) {
  const facebookAccessToken = fastify?.config.FACEBOOK_ACCESS_TOKEN;
  const facebookAdAccountId = fastify?.config.FACEBOOK_AD_ACCOUNT_ID;
  const facebookPageId = fastify?.config.FACEBOOK_PAGE_ID;
  const facebookAdsetStatus = fastify?.config.FACEBOOK_ADSET_STATUS;
  const baseUrl = fastify?.config.BASE_URL;
  const instagramAdId = "6309923639058386";

  const fbAdsApi = bizSdk.FacebookAdsApi.init(facebookAccessToken);
  const showDebugingInfo = true;
  fbAdsApi.setDebug(showDebugingInfo);

  const logApiCallResult = (apiCallName, data) => {
    if (showDebugingInfo) {
      logger.info("API called: " + apiCallName);
      logger.info("Data:" + JSON.stringify(data));
    }
  };

  const getPayment = async (paymentId) => {
    return await prisma.payments.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        pets: {
          include: {
            pet_images: true,
          },
        },
      },
    });
  };

  const createFbAdCampaign = async (_fbCampaignCount: number) => {
    let fields = [];
    let params = {
      name: `Lost-Petto-${_fbCampaignCount?._count?.id + 1}`,
      objective: "LINK_CLICKS",
      status: "ACTIVE",
      special_ad_categories: [],
    };

    const campaign = await new AdAccount(facebookAdAccountId).createCampaign(
      fields,
      params
    );

    if (!campaign) {
      logger.error("Failed to create campaign");
      throw new Error("Failed to create campaign");
    }

    const dbFbCampaign = await prisma.fb_campaigns.create({
      data: {
        fb_campaign_id: campaign?.id,
        name: params.name,
        objective: params.objective,
        status: params.status,
      },
    });

    logApiCallResult("campaigns api call complete.", campaign);

    return dbFbCampaign;
  };

  const createAdSet = async (
    _pet: Object,
    _payment: Object,
    _fbCampaignCount: string,
    _fbAdSetCount: string
  ) => {
    let campaign = null;
    let fbCampaignId = null;
    if (_fbAdSetCount?._count?.id % 4500 === 0) {
      campaign = await createFbAdCampaign(_fbCampaignCount);
      fbCampaignId = campaign.fb_campaign_id;
    } else {
      const latestAdset = await prisma.fb_adsets.findFirst({
        orderBy: { created_at: "desc" },
      });

      campaign = await prisma.fb_campaigns.findUnique({
        where: {
          id: latestAdset?.campaign_id,
        },
      });

      logger.info("campaign", campaign);

      fbCampaignId = campaign?.fb_campaign_id;
    }

    let adsetFields = [];
    let adsetParams = {
      name: _payment.id,
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      daily_budget: 600,
      campaign_id: fbCampaignId,
      status: facebookAdsetStatus,
      bid_strategy: "LOWEST_COST_WITH_BID_CAP",
      bid_amount: 100,
      targeting: {
        geo_locations: {
          custom_locations: [
            {
              latitude: _pet.latitude,
              longitude: _pet.longitude,
              radius: 10,
              distance_unit: "mile",
            },
          ],
        },
      },
    };
    logger.info("adsetParams", adsetParams);

    try {
      const adSet = await new AdAccount(facebookAdAccountId).createAdSet(
        adsetFields,
        adsetParams
      );

      logApiCallResult("adsets api call complete.", adSet);

      if (!adSet) throw new Error("Adset failed");

      const dbFbAdset = await prisma.fb_adsets.create({
        data: {
          optimization_goal: adsetParams.optimization_goal,
          billing_event: adsetParams.billing_event,
          daily_budget: adsetParams.daily_budget,
          campaign_id: campaign?.id,
          targeting: adsetParams.targeting,
          status: "PENDING_REVIEW",
          fb_adset_id: adSet?.id,
        },
      });

      logger.info("adsetParams", dbFbAdset);

      if (!dbFbAdset) {
        logger.error("DB - FB Adset failed");
        throw new Error({ message: "DB - FB Adset failed" });
      }

      const payment = await prisma.payments.update({
        where: {
          id: _payment.id,
        },
        data: {
          adset_id: dbFbAdset.id,
        },
      });

      if (!payment) {
        logger.error("DB - Payment failed to update");
        throw new Error({ message: "DB - Payment failed to update" });
      }

      return dbFbAdset;
    } catch (error) {
      logger.error("Adset failed", error);
      throw new Error(error);
    }
  };

  const createAd = async (_adset: string, _pet: Object) => {
    if (!_pet) {
      logger.error("No pet found");
      throw new Error("No pet found");
    }

    let petType: string = "";
    if (_pet.status === 2) {
      petType = "found";
    } else {
      petType = "lost";
    }

    try {
      let childAttachments = () => {
        const petImages = _pet.pet_images || [];
        const childAttachments = [];
        petImages.forEach((image) => {
          childAttachments.push({
            name: "Have you seen me?",
            link: `${baseUrl}/pets?type=${petType}&pet_id=${_pet.id}`,
            picture: image.url,
            description: `I was lost at ${_pet.address}`,
          });
        });

        return childAttachments;
      };

      let adCreativeFields = [];
      let adCreativeParams = {
        name: _pet.id,
        effective_instagram_media_id: instagramAdId,
        object_story_spec: {
          page_id: facebookPageId,
          link_data: {
            link: `${baseUrl}`,
            child_attachments: childAttachments(_pet),
          },
        },
      };

      const adCreative = await new AdAccount(
        facebookAdAccountId
      ).createAdCreative(adCreativeFields, adCreativeParams);

      logApiCallResult("ad creative api call complete.", adCreative);

      let adFields = [];
      let adParams = {
        name: _pet.id,
        adset_id: _adset.fb_adset_id,
        creative: { creative_id: adCreative.id },
        body: `Last seen at ${_pet.address}`,
        status: facebookAdsetStatus,
      };

      const ad = await new AdAccount(facebookAdAccountId).createAd(
        adFields,
        adParams
      );

      logger.info({ type: "ad", data: ad });

      if (!ad) {
        logger.error("Ad failed to create");
        throw new Error({ message: "Ad failed to create" });
      }

      const updatedDbFbAdset = await prisma.fb_adsets.update({
        where: {
          id: _adset.id,
        },
        data: {
          fb_ad_id: ad.id,
        },
      });

      logger.info({ type: "updatedDbFbAdset", data: updatedDbFbAdset });

      if (!updatedDbFbAdset)
        throw Error({ message: "DB - Update fb adset failed" });

      return ad;
    } catch (error) {
      console.log("🚀 ~ file: fbAds.ts:212 ~ createAd ~ error", error);
    }
  };

  const createFbAdFlow = async (_paymentId: string) => {
    if (!_paymentId) throw new Error("No payment found");

    const payment = await getPayment(_paymentId);

    if (payment?.status !== 1) throw new Error("Payment has not been made");
    if (payment?.adset_id) throw new Error("Ad already created");
    if (payment?.pets?.status === 0 || payment.pets?.status === 3)
      throw new Error("Set pet status as lost or found");
    if (payment.pets?.is_deleted)
      throw new Error("Archived pet cannot create ads");

    const fbCampaignCount = await prisma.fb_campaigns.aggregate({
      _count: {
        id: true,
      },
    });

    let fbAdSetCount = await prisma.fb_adsets.aggregate({
      _count: {
        id: true,
      },
      where: {
        status: {
          notIn: ["ARCHIVED"],
        },
      },
    });

    let pet = payment.pets;

    if (!pet) throw new Error("No pet found");

    const adset = await createAdSet(
      pet,
      payment,
      fbCampaignCount,
      fbAdSetCount
    );

    logger.info("adset", adset);

    const ad = await createAd(adset, pet);

    logger.info("ad", ad);

    return {
      ad,
      adset,
    };
  };

  fastify.post(
    "/api/v1/fb/ad",
    async (request: FastifyRequest, reply: FastifyReply) => {
      request.log.info("GET /api/v1/fb/ad", request);
      let { payment_id } = request.body;

      const adData = await createFbAdFlow(payment_id);
      reply.send(adData);
    }
  );

  const getFbAdInsights = async (adId: string) => {
    let adInsightsField = [
      "ad_id",
      "impressions",
      "inline_link_click_ctr",
      "reach",
      "interactive_component_tap",
      "account_id",
    ];
    let adInsightsParams = {
      data_preset: "maximum",
    };

    let insights = await new Ad(adId).getInsights(
      adInsightsField,
      adInsightsParams
    );

    return insights.data;
  };

  const getFbAd = async (adId: string) => {
    let fbAdField = [
      "status",
      "effective_status",
      "preview_shareable_link",
      "updated_time",
    ];
    let fbAdParams = {};
    logger.info({ type: "GET /api/v1/fb/ad", data: adId });

    try {
      let ad = await new Ad(adId).get(fbAdField, fbAdParams);
      logger.info({ type: "GET /api/v1/fb/ad", data: ad });
      return ad;
    } catch (error) {
      logger.info({ type: "GET /api/v1/fb/ad", data: error });
      return;
    }
  };

  const findAllAdsByStatus = async (statuses: string[]) => {
    const adsets = await prisma.fb_adsets.findMany({
      where: {
        status: {
          in: statuses,
        },
        fb_ad_id: {
          not: null,
        },
        fb_adset_id: {
          not: null,
        },
      },
      orderBy: {
        created_at: "desc",
      },
      include: {
        payments: {
          include: {
            stripe_products: {
              select: {
                id: true,
                quantity: true,
              },
            },
          },
        },
      },
    });

    return adsets || [];
  };

  const fbAdInsightsTask = async () => {
    logger.info("fbAdInsightsTask");
    let dbFbAdsets = await findAllRunningAds();
    logger.info({ type: "fbAdInsightsTask: dbFbAdsets", data: dbFbAdsets });
    if (!dbFbAdsets) {
      logger.error("No running ads found");
      throw new Error({ message: "No running ads found" });
    }
    // return;

    for (const dbAdset of dbFbAdsets) {
      const fbAdSetInsight = await getFbAdInsights(dbAdset.fb_adsets?.fb_ad_id);
      logger.info({
        type: "fbAdInsightsTask: fbAdSetInsight",
        data: fbAdSetInsight,
      });
      if (!fbAdSetInsight) continue;
      logger.info("fbAdSetInsight", fbAdSetInsight);

      updateAdDetails({
        adId: _dbFbAdset.id,
        impressions: fbAdSetInsight.impressions || 0,
        linkClicks: fbAdSetInsight.inline_link_clicks || 0,
        reach: fbAdSetInsight.reach || 0,
      });
    }
  };

  const archiveFbAdTask = async () => {
    const dbAdsets = await findAllFoundExpiredAds();
    logger.info({ type: "archiveFbAdTask: dbAdsets", data: dbAdsets });
    if (!dbAdsets || dbAdsets.length === 0) {
      logger.error("No adsets found");
      return;
    }

    for (const dbAdset of dbAdsets) {
      logger.info({
        type: "Archive Fb Ad Task",
        data: dbAdset.fb_adsets?.fb_adset_id,
      });
      let archivedAdSet = await archiveAdSet(dbAdset.fb_adsets?.fb_adset_id);
      logger.info({
        type: "Archive Fb Ad Task",
        data: archivedAdSet,
      });
      if (!archivedAdSet) continue;
      let payment = await prisma.payments.update({
        where: {
          id: dbAdset.payments[0].id,
        },
        data: {
          status: 2,
        },
      });
      logger.info({
        type: "Archive Fb Ad Task",
        data: payment,
      });
    }

    return dbAdsets;
  };

  const fbAdStatusCheckTask = async () => {
    logger.info({
      type: "fbAdStatusCheckTask",
      data: "Run fb ad status check task",
    });
    const dbAdsets = await findAllAdsByStatus(["PENDING_REVIEW", "PAUSED"]);

    logger.info({ type: "fbAdStatusCheckTask - dbAdsets", data: dbAdsets });
    if (!dbAdsets || dbAdsets.length === 0) {
      logger.error("No adsets found");
      return;
    }

    for (const dbAdset of dbAdsets) {
      const fbAd = await getFbAd(dbAdset.fb_ad_id);

      logger.info({ type: "fbAdStatusCheckTask - fbAd", data: fbAd });
      if (!fbAd) continue;

      await updateAdDetails(dbAdset.id, {
        status: fbAd._data.effective_status,
        fbAdPreviewUrl: fbAd._data.preview_shareable_link,
        statusCheckDate: new Date(),
      });

      // TODO: remove effective status for paused
      if (
        fbAd._data.effective_status === "ACTIVE" ||
        fbAd._data.effective_status === "PAUSED"
      ) {
        const expiryDate = new Date(
          new Date().setDate(
            new Date().getDate() +
              dbAdset.payments[0]?.stripe_products?.quantity
          )
        );
        await updateFbAdsetEndTime(dbAdset.fb_adset_id, expiryDate);
        await prisma.payments.update({
          where: {
            id: dbAdset.payments[0].id,
          },
          data: {
            start_date: new Date(),
            end_date: new Date(
              new Date().setDate(
                new Date().getDate() +
                  dbAdset.payments[0]?.stripe_products?.quantity
              )
            ),
          },
        });
      }
    }
  };

  const updateFbAdsetEndTime = async (adSetId: string, expiryDate: Date) => {
    let fbAdsetField = [""];
    let fbAdsetParams = {
      end_time: expiryDate,
    };

    return await new Ad(adSetId).update(fbAdsetField, fbAdsetParams);
  };

  const archiveAdSet = async (adSetId: string) => {
    logger.info("archiveAdSet", "archiving adset", adSetId);
    let fbAdsetField = [""];
    let fbAdsetParams = {
      end_time: new Date(),
      status: "DELETED",
    };

    return await new Ad(adSetId).update(fbAdsetField, fbAdsetParams);
  };

  // const runArchivedAdSet = async () => {};

  const updateAdDetails = async (
    adSetId: string,
    { status, impressions, linkClicks, reach, statusCheckDate, fbAdPreviewUrl }
  ) => {
    const adsets = await prisma.fb_adsets.update({
      where: {
        id: adSetId,
      },
      data: {
        ...(status && { status }),
        ...(impressions && { impression_count: impressions }),
        ...(linkClicks && { link_clicks_count: linkClicks }),
        ...(reach && { reach_count: reach }),
        ...(statusCheckDate && { status_check_date: statusCheckDate }),
        ...(fbAdPreviewUrl && { fb_ad_preview_url: fbAdPreviewUrl }),
      },
    });

    return adsets || [];
  };

  // FOR IMPRESSIONS
  // GET ALL ADS IMPRESSIONS AND CLICK THROUGH
  const findAllRunningAds = async () => {
    // Get all adsets which payments are running and not ended
    const payments = await prisma.payments.findMany({
      where: {
        status: 1,
        fb_adsets: {
          status: "PAUSED",
          fb_ad_id: {
            not: null,
          },
          fb_adset_id: {
            not: null,
          },
        },
        start_date: {
          lte: new Date(),
        },
        end_date: {
          gte: new Date(),
        },
      },
      include: {
        fb_adsets: true,
      },
      // TODO: Add the sorting by oldest insight updated
    });

    logger.info("findAllRunningAds", payments);

    return payments || [];
  };

  const findAllFoundExpiredAds = async () => {
    // Get all adsets which payments are running and not ended
    const payments = await prisma.payments.findMany({
      where: {
        status: 1,
        fb_adsets: {
          status: {
            in: ["PAUSED", "ACTIVE"],
          },
          fb_ad_id: {
            not: null,
          },
          fb_adset_id: {
            not: null,
          },
        },
        OR: [
          {
            end_date: {
              lte: new Date(),
            },
          },
          {
            pets: {
              status: 3,
            },
          },
        ],
      },
      include: {
        fb_adsets: true,
        pets: true,
      },
      // TODO: Add the sorting by oldest insight updated
    });

    return payments || [];
  };

  const runFbAdInsightsTask = new AsyncTask(
    "Get latest impressions & clicks",
    () => {
      logger.info("fb ad insights task");
      return fbAdInsightsTask();
    },
    (err: Error) => {
      logger.error("runFbAdInsightsTask", err);
    }
  );

  const runFbAdStatusCheckTask = new AsyncTask(
    "Fb ad status check",
    () => {
      logger.info("fb ad status check");
      return fbAdStatusCheckTask();
    },
    (err: Error) => {
      logger.error({ type: "runFbAdStatusCheckTask 1", data: err });
    }
  );

  const runArchiveFbAdTask = new AsyncTask(
    "Archive fb ad",
    () => {
      logger.info("archive fb ad");
      return archiveFbAdTask();
    },
    (err: Error) => {
      logger.error({ type: "runArchiveFbAdTask Error", data: err });
    }
  );

  fastify.scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob({ minutes: 60 }, runFbAdInsightsTask)
  );
  fastify.scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob({ minutes: 30 }, runArchiveFbAdTask)
  );
  fastify.scheduler.addSimpleIntervalJob(
    new SimpleIntervalJob({ minutes: 15 }, runFbAdStatusCheckTask)
  );
}
