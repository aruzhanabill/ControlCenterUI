import { memo, useCallback, useState } from "react";

import { useLaunchMachineSelector } from "./launchMachineProvider";
import { MessagesModal } from "./messagesModal";
import { PreFirePanel } from "./preFirePanel";
import { RecoveryPanel } from "./recoveryPanel";
import { TopStatusPanel } from "./topStatusPanel";

export const ControlCenter = memo(function ControlCenter() {
  const [messagesModalOpen, setMessagesModalOpen] = useState(false);

  const openMessagesModal = useCallback(() => {
    setMessagesModalOpen(true);
  }, []);

  const closeMessagesModal = useCallback(() => {
    setMessagesModalOpen(false);
  }, []);

  const isRecovery = useLaunchMachineSelector(
    (state) => state.context.launchState.activePanel === "recovery",
  );

  const mainPanel = isRecovery ? <RecoveryPanel /> : <PreFirePanel />;

  return (
    <>
      <div className="h-full p-4 grid grid-rows-[auto,minmax(0,1fr)] gap-4 scrollable">
        <TopStatusPanel openMessagesModal={openMessagesModal} />
        {mainPanel}
      </div>
      <MessagesModal open={messagesModalOpen} onClose={closeMessagesModal} />
    </>
  );
});
