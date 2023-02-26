// @ts-nocheck
import { prisma } from "../prisma";
import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
const bizSdk = require("facebook-nodejs-business-sdk");
const { SimpleIntervalJob, AsyncTask } = require("toad-scheduler");
const AdAccount = bizSdk.AdAccount;
const Ad = bizSdk.Ad;

export function fbAdRoutes(fastify: FastifyInstance) {
  const facebookAccessToken = fastify?.config.FACEBOOK_ACCESS_TOKEN;
  const facebookAdAccountId = fastify?.config.FACEBOOK_AD_ACCOUNT_ID;
  const facebookPageId = fastify?.config.FACEBOOK_PAGE_ID;

  const fbAdsApi = bizSdk.FacebookAdsApi.init(facebookAccessToken);
  const showDebugingInfo = true;
  fbAdsApi.setDebug(showDebugingInfo);

  const logApiCallResult = (apiCallName, data) => {
    console.log(apiCallName);
    if (showDebugingInfo) {
      console.log("Data:" + JSON.stringify(data));
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

    if (!campaign) throw new Error("Failed to create campaign");

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

      console.log(
        "🚀 ~ file: fbAds.ts:83 ~ fbAdRoutes ~ latestAdset",
        campaign
      );

      fbCampaignId = campaign?.fb_campaign_id;
    }

    let adsetFields = [];
    let adsetParams = {
      name: _payment.id,
      optimization_goal: "LINK_CLICKS",
      billing_event: "IMPRESSIONS",
      daily_budget: 600,
      campaign_id: fbCampaignId,
      status: "PAUSED",
      bid_strategy: "LOWEST_COST_WITH_BID_CAP",
      bid_amount: 100,
      targeting: {
        geo_locations: {
          custom_locations: [
            {
              latitude: 45.458311,
              longitude: -72.902611,
              radius: 5,
              distance_unit: "mile",
            },
          ],
        },
      },
    };
    console.log(
      "🚀 ~ file: fbAds.ts:109 ~ fbAdRoutes ~ adsetParams",
      adsetParams.targeting.geo_locations
    );

    console.log(
      "🚀 ~ file: fbAds.ts:109 ~ fbAdRoutes ~ adsetParams",
      adsetParams
    );

    try {
      const adSet = await new AdAccount(facebookAdAccountId).createAdSet(
        adsetFields,
        adsetParams
      );

      logApiCallResult("adsets api call complete.", adSet);

      if (!adSet) throw new Error("Adset failed");

      console.log("🚀 ~ file: fbAds.ts:77 ~ fbAdRoutes ~ campaign", campaign);

      const dbFbAdset = await prisma.fb_adsets.create({
        data: {
          optimization_goal: adsetParams.optimization_goal,
          billing_event: adsetParams.billing_event,
          daily_budget: adsetParams.daily_budget,
          campaign_id: campaign?.id,
          targeting: adsetParams.targeting,
          status: "PENDING REVIEW",
          fb_adset_id: adSet?.id,
        },
      });
      console.log(
        "🚀 ~ file: fbAds.ts:159 ~ fbAdRoutes ~ dbFbAdset:",
        dbFbAdset
      );

      if (!dbFbAdset) throw new Error({ message: "DB - FB Adset failed" });

      const payment = await prisma.payments.update({
        where: {
          id: _payment.id,
        },
        data: {
          adset_id: dbFbAdset.id,
        },
      });

      if (!payment)
        throw new Error({ message: "DB - Payment failed to update" });

      console.log(
        "🚀 ~ file: fbAds.ts:139 ~ fbAdRoutes ~ dbFbAdset",
        dbFbAdset
      );

      return dbFbAdset;
    } catch (error) {
      console.log(error);
    }
  };

  const createAd = async (_adset: string, _pet: Object) => {
    if (!_pet) throw new Error("No pet found");

    console.log("create ad");

    try {
      let childAttachments = () => {
        const petImages = _pet.pet_images?.splice(0, 1) || [];
        const childAttachments = [];
        petImages.forEach((image) => {
          childAttachments.push({
            link: `https://lost-dogge.com/pet/lost/${_pet.id}`,
            picture: image.url,
          });
        });

        return childAttachments;
      };

      console.log(_pet);

      let adCreativeFields = [];
      let adCreativeParams = {
        name: _pet.id,
        object_story_spec: {
          page_id: facebookPageId,
          link_data: {
            link: `http://lostdoggo.com`,
            picture: _pet.pet_images[0].url,
          },
        },
        child_attachments: childAttachments(_pet),
      };

      const adCreative = await new AdAccount(
        facebookAdAccountId
      ).createAdCreative(adCreativeFields, adCreativeParams);

      logApiCallResult("ad creative api call complete.", adCreative);

      console.log("adset", _adset);

      let adFields = [];
      let adParams = {
        name: _pet.id,
        adset_id: _adset.fb_adset_id,
        creative: { creative_id: adCreative.id },
        body: `Last seen at ${_pet.address}`,
        status: "PAUSED",
      };

      const ad = await new AdAccount(facebookAdAccountId).createAd(
        adFields,
        adParams
      );

      console.log(ad);

      if (!ad) throw new Error({ message: "Ad failed to create" });

      const updatedDbFbAdset = await prisma.fb_adsets.update({
        where: {
          id: _adset.id,
        },
        data: {
          fb_ad_id: ad.id,
        },
      });

      console.log(updatedDbFbAdset);

      if (!updatedDbFbAdset)
        throw Error({ message: "DB - Update fb adset failed" });

      return ad;

      logApiCallResult("ads api call complete.", ad);
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

    const fbCampaignCount = await prisma.fb_campaigns.aggregate({
      _count: {
        id: true,
      },
    });

    let fbAdSetCount = await prisma.fb_adsets.aggregate({
      _count: {
        id: true,
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
    console.log("🚀 ~ file: fbAds.ts:290 ~ createFbAdFlow ~ adset:", adset);

    const ad = await createAd(adset, pet);

    console.log(adset);
    console.log(ad);

    return {
      ad,
      adset,
    };
  };

  fastify.post(
    "/api/v1/fb/ad",
    async (request: FastifyRequest, reply: FastifyReply) => {
      let { payment_id } = request.body;

      const adData = await createFbAdFlow(payment_id);
      reply.send(adData);
    }
  );

  // const task = new AsyncTask(
  //   "Get latest impressions & clicks",
  //   () => {
  //     return db.pollForSomeData().then((result) => {
  //       /* continue the promise chain */
  //     });
  //   },
  //   (err: Error) => {
  //     console.log(err);
  //     /* handle error here */
  //   }
  // );
  // const job = new SimpleIntervalJob({ seconds: 20 }, task);

  // fastify.scheduler.addSimpleIntervalJob(job);

  // const findAllFailedAdCreations = async () => {
  //   // Get all payments made that are not have a no subscriptions
  //   const payments = await prisma.payments.findMany({
  //     where: {
  //       status: 1,
  //       adset_id: null,
  //     },
  //   });

  //   return payments || [];
  // };

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
    console.log(adId);

    try {
      let ad = await new Ad(adId).get(fbAdField, fbAdParams);
      console.log(ad);
      return ad;
    } catch (error) {
      console.log(error);
    }
  };

  const findAllAdsByStatus = async (status: string) => {
    const adsets = await prisma.fb_adsets.findMany({
      where: {
        // payments: {
        //   every: {
        //     status: 1,
        //   },
        // },
        status,
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

  const runFbAdInsightsTask = async () => {
    // console.log("hi");
    let dbFbAdsets = await findAllRunningAds();
    if (!dbFbAdsets) throw new Error({ message: "No running ads found" });
    // return;

    for (const dbAdset of dbFbAdsets) {
      const fbAdSetInsight = await getFbAdInsights(dbAdset.fb_adsets?.fb_ad_id);
      if (!fbAdSetInsight) continue;
      console.log(fbAdSetInsight);

      updateAdDetails({
        adId: _dbFbAdset.id,
        impressions: fbAdSetInsight.impressions || 0,
        linkClicks: fbAdSetInsight.inline_link_clicks || 0,
        reach: fbAdSetInsight.reach || 0,
      });
    }
  };

  const runArchiveFbAdTask = async () => {
    const dbAdsets = await findAllFoundExpiredAds();
    if (!dbAdsets || dbAdsets.length === 0)
      throw new Error({ message: "No adsets found" });

    for (const dbAdset of dbAdsets) {
      console.log("archived");
      await archiveAdSet(dbAdset.fb_adsets?.fb_adset_id);
    }

    console.log(
      "🚀 ~ file: fbAds.ts:474 ~ runArchiveFbAdTask ~ dbAdsets:",
      dbAdsets
    );
    return dbAdsets;
    console.log(dbAdsets);
  };

  const runFbAdStatusCheckTask = async () => {
    console.log("run fb ad status");
    const dbAdsets = await findAllAdsByStatus("PAUSED");
    console.log("db adsets", dbAdsets);
    if (!dbAdsets || dbAdsets.length === 0)
      throw new Error({ message: "No adsets found" });

    for (const dbAdset of dbAdsets) {
      console.log("db adset", dbAdset);
      const fbAd = await getFbAd(dbAdset.fb_ad_id);

      if (!fbAd) continue;

      console.log("fb ad details", fbAd._data);
      await updateAdDetails(dbAdset.id, {
        status: fbAd._data.effective_status,
        statusCheckDate: new Date(),
      });

      // TODO: remove effective status for paused
      if (
        fbAd._data.effective_status === "ACTIVE" ||
        fbAd._data.effective_status === "PAUSED"
      ) {
        console.log("dbAdsetId", dbAdset.id);
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
    let fbAdsetField = [""];
    let fbAdsetParams = {
      end_time: new Date(),
      status: "DELETED",
    };
    console.log("deletion");

    return await new Ad(adSetId).update(fbAdsetField, fbAdsetParams);
  };

  // const runArchivedAdSet = async () => {};

  const updateAdDetails = async (
    adSetId: string,
    { status, impressions, linkClicks, reach, statusCheckDate }
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
        // status: "PAUSED",
      },
      include: {
        fb_adsets: true,
      },
      // TODO: Add the sorting by oldest insight updated
    });

    console.log(payments);

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
}
