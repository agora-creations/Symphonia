import { Composition } from "remotion";
import type { FC } from "react";
import {
  AutomationControlledVideo,
  ClariseMilestoneVideo,
  ConnectRepositoryVideo,
  TaskToReviewVideo,
} from "./ProductVideos";

export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="ConnectRepository"
        component={ConnectRepositoryVideo}
        durationInFrames={360}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="ClariseMilestone"
        component={ClariseMilestoneVideo}
        durationInFrames={540}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="TaskToReview"
        component={TaskToReviewVideo}
        durationInFrames={390}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="AutomationControlled"
        component={AutomationControlledVideo}
        durationInFrames={420}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
