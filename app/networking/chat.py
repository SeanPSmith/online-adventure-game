from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from uuid import uuid4


@dataclass(frozen=True)
class ChatMessage:
    id: str
    player_name: str
    text: str
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


class ChatManager:

    def __init__(
        self,
        history_limit: int = 100,
    ) -> None:

        self._history_limit = (
            history_limit
        )

        self._rooms: dict[
            str,
            deque[ChatMessage]
        ] = defaultdict(
            self._create_history
        )

    def _create_history(
        self,
    ) -> deque[ChatMessage]:

        return deque(
            maxlen=self._history_limit
        )

    def create_message(
        self,
        room_code: str,
        player_name: str,
        text: str,
    ) -> ChatMessage:

        message = ChatMessage(
            id=str(uuid4()),
            player_name=player_name,
            text=text.strip(),
            timestamp=datetime.now(
                timezone.utc
            ).isoformat(),
        )

        self._rooms[
            room_code
        ].append(
            message
        )

        return message

    def history(
        self,
        room_code: str,
    ) -> list[dict]:

        return [
            message.to_dict()
            for message
            in self._rooms.get(
                room_code,
                [],
            )
        ]
        
    def clear(self) -> None:
  
        self._rooms.clear()

    def restore_room(
        self,
        room_code: str,
        messages: list[dict],
    ) -> None:

        history = deque(
            maxlen=self._history_limit
        )

        for data in messages:

            history.append(
                ChatMessage(
                    id=str(
                        data["id"]
                    ),

                    player_name=str(
                        data["player_name"]
                    ),

                    text=str(
                        data["text"]
                    ),

                    timestamp=str(
                        data["timestamp"]
                    ),
                )
            )

        self._rooms[
            room_code
        ] = history

    def remove_room(
        self,
        room_code: str,
    ) -> None:

        self._rooms.pop(
            room_code,
            None,
        )


chat = ChatManager()